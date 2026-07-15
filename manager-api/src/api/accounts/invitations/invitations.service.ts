import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { In, IsNull, Repository } from "typeorm";
import { AntiEscalationService, type ActingUser } from "../../../core/acl/anti-escalation.service";
import { CustomPermissionGuardService } from "../../../core/custom-permission-guard/custom-permission-guard.service";
import { AccountInvitation } from "../../../core/entities/account-invitation.entity";
import { Account } from "../../../core/entities/account.entity";
import { AccountProfile } from "../../../core/entities/account-profile.entity";
import { Group } from "../../../core/entities/group.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { MailerService } from "../../../core/mailer/mailer.service";
import type { AcceptInvitationDto, SendInvitationDto } from "./invitations.validation";

@Injectable()
export class AccountsInvitationsService {
  constructor(
    @InjectRepository(AccountInvitation) private readonly invitations: Repository<AccountInvitation>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    private readonly mailer: MailerService,
    private readonly cpg: CustomPermissionGuardService,
    private readonly antiEscalation: AntiEscalationService
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

  async sendInvitation(actingUser: ActingUser, input: SendInvitationDto, baseUrl: string) {
    const existing = await this.invitations.findOne({
      where: { email: input.email, acceptedAt: IsNull() },
    });
    if (existing && existing.expiresAt > new Date()) {
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

    const groups = input.groupIds.length ? await this.groups.findBy({ id: In(input.groupIds) }) : [];
    if (groups.length !== input.groupIds.length) throw new NotFoundException("One or more groups not found");
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

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.invitations.save(
      this.invitations.create({
        token,
        email: input.email,
        invitedBy: actingUser.id,
        groupId: null,
        groupIds: JSON.stringify(input.groupIds),
        ownerDomainId: input.makeOwner ? domain.id : null,
        expiresAt,
      })
    );

    const link = `${baseUrl.replace(/\/+$/, "")}/invite/${token}`;
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
    if (inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    const groupIds = this.parseGroupIds(inv);
    const groups = groupIds.length ? await this.groups.findBy({ id: In(groupIds) }) : [];
    return { email: inv.email, groups: groups.map((g) => g.name), expiresAt: inv.expiresAt };
  }

  async acceptInvitation(token: string, input: AcceptInvitationDto) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    if (await this.accounts.findOne({ where: { email: inv.email } })) {
      throw new ConflictException(`An account with email "${inv.email}" already exists`);
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const account = await this.accounts.save(
      this.accounts.create({
        email: inv.email,
        password: passwordHash,
        isRoot: 0,
        enabled: 1,
      })
    );
    await this.profiles.save(this.profiles.create({ accountId: account.id, displayName: input.displayName ?? null }));
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
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    return { ok: true, email: account.email };
  }
}
