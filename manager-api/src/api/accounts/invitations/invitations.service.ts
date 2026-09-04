import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { In, IsNull, Repository } from "typeorm";
import { AntiEscalationService, type ActingUser } from "../../../core/acl/anti-escalation.service";
import { scryptHash } from "../../../core/common/scrypt";
import { CustomPermissionGuardService } from "../../../core/custom-permission-guard/custom-permission-guard.service";
import { AccountInvitation } from "../../../core/entities/account-invitation.entity";
import { Account } from "../../../core/entities/account.entity";
import { AccountProfile } from "../../../core/entities/account-profile.entity";
import { Group } from "../../../core/entities/group.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { MailerService } from "../../../core/mailer/mailer.service";
import { AppSettingsService } from "../../../core/settings/app-settings.service";
import { DelegationsService } from "../../domains/delegations/delegations.service";
import type { AcceptInvitationDto, SendInvitationDto } from "./invitations.validation";
import { ActivityLogService } from "../../../core/activity/activity-log.service";

@Injectable()
export class AccountsInvitationsService {
  constructor(
    @InjectRepository(AccountInvitation) private readonly invitations: Repository<AccountInvitation>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>,
    private readonly mailer: MailerService,
    private readonly cpg: CustomPermissionGuardService,
    private readonly antiEscalation: AntiEscalationService,
    private readonly appSettings: AppSettingsService,
    private readonly delegationsSvc: DelegationsService,
    private readonly activity: ActivityLogService
  ) {}

  private parseGroupIds(inv: AccountInvitation): string[] {
    if (inv.groupIds) {
      try {
        const parsed = JSON.parse(inv.groupIds) as unknown;
        if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
      } catch {
        // fall back to the legacy single group_id below
      }
    }
    return inv.groupId ? [inv.groupId] : [];
  }

  private parseIds(raw: string | null): number[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((x): x is number => typeof x === "number");
    } catch {
      // malformed JSON: treat as none
    }
    return [];
  }

  // Only currently-unassigned recipients/aliases of the chosen domain may be
  // attached through an invitation, and only by a caller who holds the global
  // assign action. postmaster@ is never ownable.
  private async assertAssignableRecipients(actingUser: ActingUser, ids: number[], domain: string) {
    if (!ids.length) return;
    if (!actingUser.isRoot) {
      await this.cpg.guard.assertOne.global(actingUser.id, "accounts", { acrud: ["assign-recipient-owner"] });
    }
    const rows = await this.recipients.findBy({ id: In(ids) });
    if (rows.length !== new Set(ids).size) throw new NotFoundException("One or more recipients not found");
    if (rows.some((r) => r.domain !== domain)) throw new BadRequestException("A recipient does not belong to the chosen domain");
    if (rows.some((r) => r.email.toLowerCase().startsWith("postmaster@")))
      throw new BadRequestException("postmaster@ cannot be assigned to an account");
    if (rows.some((r) => r.ownerId)) throw new ConflictException("A recipient is already assigned to an account");
  }

  private async assertAssignableAliases(actingUser: ActingUser, ids: number[], domain: string) {
    if (!ids.length) return;
    if (!actingUser.isRoot) {
      await this.cpg.guard.assertOne.global(actingUser.id, "accounts", { acrud: ["assign-alias-owner"] });
    }
    const rows = await this.aliases.findBy({ id: In(ids) });
    if (rows.length !== new Set(ids).size) throw new NotFoundException("One or more aliases not found");
    if (rows.some((a) => a.domain !== domain)) throw new BadRequestException("An alias does not belong to the chosen domain");
    if (rows.some((a) => a.source.toLowerCase().startsWith("postmaster@")))
      throw new BadRequestException("postmaster@ cannot be assigned to an account");
    if (rows.some((a) => a.ownerId)) throw new ConflictException("An alias is already assigned to an account");
  }

  async sendInvitation(actingUser: ActingUser, input: SendInvitationDto, baseUrl: string) {
    const existing = await this.invitations.findOne({
      where: { email: input.email, acceptedAt: IsNull() },
    });
    if (existing && (existing.expiresAt === null || existing.expiresAt > new Date())) {
      existing.expiresAt = new Date();
      await this.invitations.save(existing);
    }

    // A domain is mandatory: the email is sent from postmaster@<domain> (an
    // address every domain must have) so it is not treated as spam. Never fall
    // back to internal defaults.
    const domain = await this.domains.findOne({ where: { id: input.domainId } });
    if (!domain) throw new NotFoundException(`Domain #${input.domainId} not found`);

    // Making the invitee the domain owner reassigns virtual_domains.owner_id
    // (single owner) on acceptance -- a sensitive move that requires ALL of:
    // accounts:set-domain-owner (handing ownership out through an invitation),
    // domains:transfer-domain-ownership (the bridge mirror transferring ownership
    // of any domain) and domain_owner_elevated:transfer-domain-ownership (the
    // elevated escape hatch). Root bypasses ACL as everywhere else.
    if (input.makeOwner && !actingUser.isRoot) {
      await this.cpg.guard.assertOne.global(actingUser.id, "accounts", { acrud: ["set-domain-owner"] });
      await this.cpg.guard.assertOne.global(actingUser.id, "domains", { acrud: ["transfer-domain-ownership"] });
      await this.cpg.guard.assertOne.global(actingUser.id, "domain_owner_elevated", { acrud: ["transfer-domain-ownership"] });
    }

    // useDomainGroup joins the invitee to the group dedicated to this domain
    // (found by its imposed name, or created here if it does not exist yet).
    // The group's mere existence is NOT the signal -- once created it stays in
    // the DB forever, so membership must follow this flag's CURRENT value, not
    // whether a past invite for the same domain happened to create the group.
    // Folded into the same groupIds the rest of this method already handles, so
    // anti-escalation and acceptance-time assignment apply to it like any
    // explicitly chosen group.
    const effectiveGroupIds = new Set(input.groupIds);
    if (input.useDomainGroup) {
      const dedicatedName = `__custom-${domain.domain}-group`;
      let dedicated = await this.groups.findOne({ where: { name: dedicatedName } });
      if (!dedicated) {
        dedicated = await this.groups.save(
          this.groups.create({ name: dedicatedName, description: null, ownerId: null, isDefault: 0 })
        );
      }
      effectiveGroupIds.add(dedicated.id);
    }
    const groupIdList = [...effectiveGroupIds];

    const groups = groupIdList.length ? await this.groups.findBy({ id: In(groupIdList) }) : [];
    if (groups.length !== groupIdList.length) throw new NotFoundException("One or more groups not found");
    // Anti-escalade: a non-root inviter may only invite into groups whose
    // permissions it already holds in full (accepting unions them onto the new
    // account). The default group, auto-assigned on creation, is the system floor
    // and is never part of this list.
    for (const group of groups) {
      const [groupGlobal, groupDomain] = await Promise.all([
        this.cpg.guard.findGroupGlobalPermissions(group.id),
        this.cpg.guard.findGroupDomainPermissions(group.id),
      ]);
      await this.antiEscalation.assertActingUserHolds(actingUser, groupGlobal, groupDomain);
    }

    // Recipients/aliases to hand over on acceptance: must be existing, unassigned
    // and in the chosen domain, and the inviter must hold the global assign action.
    const recipientIds = input.recipientIds ?? [];
    const aliasIds = input.aliasIds ?? [];
    await this.assertAssignableRecipients(actingUser, recipientIds, domain.domain);
    await this.assertAssignableAliases(actingUser, aliasIds, domain.domain);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.invitations.save(
      this.invitations.create({
        token,
        email: input.email,
        invitedBy: actingUser.id,
        groupId: null,
        groupIds: JSON.stringify(groupIdList),
        recipientIds: JSON.stringify(recipientIds),
        aliasIds: JSON.stringify(aliasIds),
        ownerDomainId: input.makeOwner ? domain.id : null,
        expiresAt,
      })
    );

    // The configured public interface address is authoritative for links that
    // reach an inbox; the request host is only a fallback when none is set.
    const configured = this.appSettings.get().managerUrl;
    const link = `${(configured || baseUrl).replace(/\/+$/, "")}/invite/${token}`;
    await this.mailer.sendInvitation({
      to: input.email,
      link,
      fromDomain: domain.domain,
      groupNames: groups.map((g) => g.name),
    });
    return { ok: true };
  }

  async getInvitation(token: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt !== null && inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    const groupIds = this.parseGroupIds(inv);
    const groups = groupIds.length ? await this.groups.findBy({ id: In(groupIds) }) : [];
    return { email: inv.email, groups: groups.map((g) => g.name), expiresAt: inv.expiresAt };
  }

  async acceptInvitation(token: string, input: AcceptInvitationDto) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt !== null && inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    // A pinned invitation carries its identity; an open token (email NULL)
    // takes the visitor's own, which then must be free.
    const email = inv.email ?? input.email;
    if (!email) throw new BadRequestException("This invitation requires an email address");
    if (await this.accounts.findOne({ where: { email } })) {
      throw new ConflictException(`An account with email "${email}" already exists`);
    }
    const passwordHash = await scryptHash(input.password);
    const account = await this.accounts.save(
      this.accounts.create({
        email,
        password: passwordHash,
        isRoot: 0,
        enabled: 1,
      })
    );
    await this.profiles.save(
      this.profiles.create({
        accountId: account.id,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
      })
    );
    // Every account gets the default group (the system floor), on top of any
    // explicitly invited groups. There is no account-creation hook, so it is
    // assigned here. assignAccountToGroup is idempotent, hence the Set.
    const groupIds = new Set(this.parseGroupIds(inv));
    const defaultGroup = await this.groups.findOne({ where: { isDefault: 1 } });
    if (defaultGroup) groupIds.add(defaultGroup.id);
    for (const groupId of groupIds) {
      await this.cpg.guard.assignAccountToGroup(account.id, groupId);
    }
    // Deferred ownership: now that the account exists, make it the domain's owner
    // (single owner on virtual_domains.owner_id, replacing any current one).
    if (inv.ownerDomainId) {
      await this.domains.update(inv.ownerDomainId, { ownerId: account.id });
    }
    // Assign the staged recipients/aliases to the fresh account -- but only those
    // still unassigned now (someone may have taken them meanwhile). Ownership
    // only; no password is touched.
    const recipientIds = this.parseIds(inv.recipientIds);
    const aliasIds = this.parseIds(inv.aliasIds);
    if (recipientIds.length) {
      await this.recipients.update({ id: In(recipientIds), ownerId: IsNull() }, { ownerId: account.id });
    }
    if (aliasIds.length) {
      await this.aliases.update({ id: In(aliasIds), ownerId: IsNull() }, { ownerId: account.id });
    }
    // Delegation staged by the domain-side invite or open token: lands now that
    // the account exists (quota clamped inside to what the domain can commit).
    await this.delegationsSvc.grantFromInvitation(inv, account.id);
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    await this.activity.record({
      action: "delegations.accepted",
      actorId: account.id,
      entity: { type: "domain", id: inv.delegationDomainId },
    });
    return { ok: true, email: account.email };
  }

  // Whether an email already has an account, told only to someone holding a
  // valid, pending OPEN link: the token gates the probe, so this is not a free
  // account-enumeration endpoint. The registration form uses it to switch
  // between "create your account" and "sign in and take the grant".
  async openTokenEmailExists(token: string, email: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    const pending = inv && !inv.acceptedAt && (inv.expiresAt === null || inv.expiresAt > new Date());
    if (!pending || inv.email !== null) throw new NotFoundException("Invitation not found");
    return { exists: (await this.accounts.findOne({ where: { email } })) !== null };
  }

  // An open registration link consumed by an EXISTING account: instead of
  // creating one, the caller takes the staged delegation for itself. Pinned
  // invitations stay tied to their email and cannot be claimed.
  async claimInvitation(token: string, accountId: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt !== null && inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    if (inv.email !== null) throw new BadRequestException("This invitation is tied to an email address");
    if (!inv.delegationDomainId) throw new BadRequestException("This link carries nothing to claim");
    await this.delegationsSvc.grantFromInvitation(inv, accountId);
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    await this.activity.record({
      action: "delegations.claimed",
      actorId: accountId,
      entity: { type: "domain", id: inv.delegationDomainId },
    });
    return { ok: true, domainId: inv.delegationDomainId };
  }
}
