import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { IsNull, MoreThan, Repository } from "typeorm";
import { ApiError } from "../../../core/common/api-error";
import { Account } from "../../../core/entities/account.entity";
import { AccountInvitation } from "../../../core/entities/account-invitation.entity";
import { DomainDelegation } from "../../../core/entities/domain-delegation.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { MailerService } from "../../../core/mailer/mailer.service";
import { AppSettingsService } from "../../../core/settings/app-settings.service";
import type {
  CreateDelegationTokenDto,
  DelegationCapsDto,
  EditDelegationInviteDto,
  InviteDelegationDto,
} from "./delegations.validation";

const MB = 1024 * 1024;
const DAY_MS = 24 * 3600 * 1000;

// Null = never expires: the invitation or link stands until revoked.
function expiryFrom(expiresDays: number | null): Date | null {
  return expiresDays === null ? null : new Date(Date.now() + expiresDays * DAY_MS);
}

function stillPending(inv: AccountInvitation): boolean {
  return inv.acceptedAt === null && (inv.expiresAt === null || inv.expiresAt > new Date());
}

// A delegation grants one account a capped self-service allowance on a domain:
// up to N recipients and N aliases (NULL = unlimited) whose combined mailbox
// quotas never exceed quota_mb. Anti-overcommit: the domain's own quota must
// always cover every existing mailbox plus every delegation's still unused
// quota, so no grant can promise disk the domain does not have.
@Injectable()
export class DelegationsService {
  constructor(
    @InjectRepository(DomainDelegation) private readonly delegations: Repository<DomainDelegation>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountInvitation) private readonly invitations: Repository<AccountInvitation>,
    private readonly mailer: MailerService,
    private readonly appSettings: AppSettingsService
  ) {}

  async resolveDomain(domainId: number): Promise<VirtualDomain> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found;
  }

  private async sumQuota(domainFqdn: string, ownerId?: string): Promise<number> {
    const qb = this.recipients
      .createQueryBuilder("r")
      .select("COALESCE(SUM(r.quota), 0)", "sum")
      .where("r.domain = :domain", { domain: domainFqdn });
    if (ownerId !== undefined) qb.andWhere("r.ownerId = :ownerId", { ownerId });
    const row = await qb.getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  countRecipientsOf(accountId: string, domainFqdn: string) {
    return this.recipients.count({ where: { domain: domainFqdn, ownerId: accountId } });
  }

  countAliasesOf(accountId: string, domainFqdn: string) {
    return this.aliases.count({ where: { domain: domainFqdn, ownerId: accountId } });
  }

  usedBytesOf(accountId: string, domainFqdn: string) {
    return this.sumQuota(domainFqdn, accountId);
  }

  // A delegation only meters what was added AFTER it was granted: the row
  // snapshots the account's counts at grant time (base_*) and usage is what
  // stands beyond that baseline. A grant of N recipients therefore always
  // allows N new ones, whatever the account owned before.
  async usedRecipientsOf(delegation: DomainDelegation, domainFqdn: string): Promise<number> {
    const count = await this.countRecipientsOf(delegation.accountId, domainFqdn);
    return Math.max(0, count - (delegation.baseRecipients ?? 0));
  }

  async usedAliasesOf(delegation: DomainDelegation, domainFqdn: string): Promise<number> {
    const count = await this.countAliasesOf(delegation.accountId, domainFqdn);
    return Math.max(0, count - (delegation.baseAliases ?? 0));
  }

  async spentBytesOf(delegation: DomainDelegation, domainFqdn: string): Promise<number> {
    const owned = await this.usedBytesOf(delegation.accountId, domainFqdn);
    return Math.max(0, owned - Number(delegation.baseBytes ?? 0));
  }

  private async unusedReserve(delegation: DomainDelegation, domainFqdn: string): Promise<number> {
    const used = await this.spentBytesOf(delegation, domainFqdn);
    return Math.max(0, delegation.quotaMb * MB - used);
  }

  // Quota promised by invitations and open links not yet used: committed from
  // the moment they are issued, freed when they expire or are revoked.
  private pendingInvitationsOf(domainId: number) {
    return this.invitations.find({
      where: [
        { delegationDomainId: domainId, acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
        { delegationDomainId: domainId, acceptedAt: IsNull(), expiresAt: IsNull() },
      ],
      order: { createdAt: "ASC" },
    });
  }

  private async pendingReservedBytes(domainId: number, excludeInvitationId?: number): Promise<number> {
    const rows = await this.pendingInvitationsOf(domainId);
    return rows.filter((r) => r.id !== excludeInvitationId).reduce((sum, r) => sum + (r.delegationQuotaMb ?? 0), 0) * MB;
  }

  // Domain quota still held for delegated accounts but not yet spent on a
  // mailbox, pending invitations and links included. RecipientsService.headroom
  // subtracts it so nobody can hand out that space twice.
  async reservedForAccountsBytes(domainId: number): Promise<number> {
    const domain = await this.resolveDomain(domainId);
    const rows = await this.delegations.find({ where: { domainId } });
    let total = await this.pendingReservedBytes(domainId);
    for (const row of rows) total += await this.unusedReserve(row, domain.domain);
    return total;
  }

  // Largest quota_mb still grantable to `accountId` on this domain: what the
  // domain quota leaves once every mailbox and every OTHER delegation's unused
  // reserve are taken out, plus what this account already spent under its own
  // grant (those bytes sit in both sums, not twice). Null on an unlimited
  // domain.
  private async grantableMb(
    domain: VirtualDomain,
    accountId: string | null,
    excludeInvitationId?: number
  ): Promise<number | null> {
    const domainQuota = Number(domain.quota);
    if (domainQuota === 0) return null;
    const allocated = await this.sumQuota(domain.domain);
    const pending = await this.pendingReservedBytes(domain.id, excludeInvitationId);
    const rows = await this.delegations.find({ where: { domainId: domain.id } });
    let othersUnused = 0;
    let ownSpent = 0;
    for (const row of rows) {
      if (accountId !== null && row.accountId === accountId) ownSpent = await this.spentBytesOf(row, domain.domain);
      else othersUnused += await this.unusedReserve(row, domain.domain);
    }
    return Math.max(0, Math.floor((domainQuota - allocated - pending - othersUnused + ownSpent) / MB));
  }

  private async assertGrantFits(
    domain: VirtualDomain,
    accountId: string | null,
    quotaMb: number,
    excludeInvitationId?: number
  ): Promise<void> {
    const grantable = await this.grantableMb(domain, accountId, excludeInvitationId);
    if (grantable === null || quotaMb <= grantable) return;
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "delegations.quotaExceedsDomain",
      `Cannot grant ${quotaMb} MB on ${domain.domain}: only ${grantable} MB can still be committed`,
      { domain: domain.domain, requestedMb: quotaMb, grantableMb: grantable }
    );
  }

  // Every grant ADDS to what the account already holds on this domain: caps
  // sum (unlimited swallows any number) and the quota ceiling grows, so
  // consuming a second 5-mailbox token raises the cap to 10. The usage
  // baseline is snapshotted once, when the delegation is born, and kept
  // across later grants; the admin's edit page (setCaps) stays absolute.
  private async upsertRow(domain: VirtualDomain, accountId: string, createdBy: string | null, caps: DelegationCapsDto) {
    const existing = await this.delegations.findOne({ where: { accountId, domainId: domain.id } });
    if (existing) {
      existing.maxRecipients =
        existing.maxRecipients === null || caps.maxRecipients === null ? null : existing.maxRecipients + caps.maxRecipients;
      existing.maxAliases =
        existing.maxAliases === null || caps.maxAliases === null ? null : existing.maxAliases + caps.maxAliases;
      existing.quotaMb = existing.quotaMb + caps.quotaMb;
      return this.delegations.save(existing);
    }
    return this.delegations.save(
      this.delegations.create({
        accountId,
        domainId: domain.id,
        maxRecipients: caps.maxRecipients,
        maxAliases: caps.maxAliases,
        quotaMb: caps.quotaMb,
        createdBy,
        baseRecipients: await this.countRecipientsOf(accountId, domain.domain),
        baseAliases: await this.countAliasesOf(accountId, domain.domain),
        baseBytes: String(await this.usedBytesOf(accountId, domain.domain)),
      })
    );
  }

  private inviteLink(baseUrl: string, token: string): string {
    const configured = this.appSettings.get().managerUrl;
    return `${(configured || baseUrl).replace(/\/+$/, "")}/invite/${token}`;
  }

  // The menu's email entry point. An existing account is granted on the spot;
  // an unknown email gets an invitation carrying the caps, landed on acceptance.
  async grantOrInvite(actingUserId: string, domainId: number, input: InviteDelegationDto, baseUrl: string) {
    const domain = await this.resolveDomain(domainId);
    const account = await this.accounts.findOne({ where: { email: input.email } });
    if (account && account.id === domain.ownerId) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "delegations.ownerNotDelegable", "The domain owner needs no delegation", {
        email: input.email,
      });
    }
    const held = account ? ((await this.delegations.findOne({ where: { accountId: account.id, domainId } }))?.quotaMb ?? 0) : 0;
    await this.assertGrantFits(domain, account?.id ?? null, held + input.quotaMb);

    if (account) {
      await this.upsertRow(domain, account.id, actingUserId, input);
      return { mode: "granted" as const, email: account.email };
    }

    const pending = await this.invitations.findOne({ where: { email: input.email, acceptedAt: IsNull() } });
    if (pending && (pending.expiresAt === null || pending.expiresAt > new Date())) {
      pending.expiresAt = new Date();
      await this.invitations.save(pending);
    }
    const token = randomBytes(32).toString("hex");
    await this.invitations.save(
      this.invitations.create({
        token,
        email: input.email,
        invitedBy: actingUserId,
        groupId: null,
        groupIds: JSON.stringify([]),
        recipientIds: JSON.stringify([]),
        aliasIds: JSON.stringify([]),
        ownerDomainId: null,
        delegationDomainId: domainId,
        delegationMaxRecipients: input.maxRecipients,
        delegationMaxAliases: input.maxAliases,
        delegationQuotaMb: input.quotaMb,
        expiresAt: expiryFrom(input.expiresDays),
      })
    );
    await this.mailer.sendInvitation({
      to: input.email,
      link: this.inviteLink(baseUrl, token),
      fromDomain: domain.domain,
      groupNames: [],
    });
    return { mode: "invited" as const, email: input.email };
  }

  // Open registration token: no pinned email, whoever opens the link creates an
  // account and receives the staged caps. Single use, expires like any invite.
  async createToken(actingUserId: string, domainId: number, caps: CreateDelegationTokenDto, baseUrl: string) {
    const domain = await this.resolveDomain(domainId);
    await this.assertGrantFits(domain, null, caps.quotaMb);
    const token = randomBytes(32).toString("hex");
    await this.invitations.save(
      this.invitations.create({
        token,
        email: null,
        invitedBy: actingUserId,
        groupId: null,
        groupIds: JSON.stringify([]),
        recipientIds: JSON.stringify([]),
        aliasIds: JSON.stringify([]),
        ownerDomainId: null,
        delegationDomainId: domainId,
        delegationMaxRecipients: caps.maxRecipients,
        delegationMaxAliases: caps.maxAliases,
        delegationQuotaMb: caps.quotaMb,
        expiresAt: expiryFrom(caps.expiresDays),
        note: caps.note,
      })
    );
    return { token, link: this.inviteLink(baseUrl, token) };
  }

  // A pending invitation or open link stays editable: caps and expiry, under
  // the same anti-overcommit rule, its own current promise left out of the sum.
  async editInvitation(domainId: number, invitationId: number, input: EditDelegationInviteDto): Promise<{ ok: true }> {
    const domain = await this.resolveDomain(domainId);
    const inv = await this.invitations.findOne({ where: { id: invitationId, delegationDomainId: domainId } });
    if (!inv || !stillPending(inv)) throw new NotFoundException(`Invitation #${invitationId} not found on domain #${domainId}`);
    await this.assertGrantFits(domain, null, input.quotaMb, invitationId);
    inv.delegationMaxRecipients = input.maxRecipients;
    inv.delegationMaxAliases = input.maxAliases;
    inv.delegationQuotaMb = input.quotaMb;
    inv.expiresAt = expiryFrom(input.expiresDays);
    if (inv.email === null) inv.note = input.note;
    await this.invitations.save(inv);
    return { ok: true };
  }

  async revokeInvitation(domainId: number, invitationId: number): Promise<{ ok: true }> {
    const inv = await this.invitations.findOne({ where: { id: invitationId, delegationDomainId: domainId } });
    if (!inv || inv.acceptedAt) throw new NotFoundException(`Invitation #${invitationId} not found on domain #${domainId}`);
    inv.expiresAt = new Date();
    await this.invitations.save(inv);
    return { ok: true };
  }

  // Called by invitation acceptance once the account exists. The quota
  // addition is clamped to what the domain can still commit at that moment
  // (never below zero, an existing grant is never reduced), so a grant staged
  // days ago can never break the anti-overcommit invariant.
  async grantFromInvitation(inv: AccountInvitation, accountId: string): Promise<void> {
    if (!inv.delegationDomainId || inv.delegationQuotaMb === null) return;
    const domain = await this.domains.findOne({ where: { id: inv.delegationDomainId } });
    if (!domain) return;
    const grantable = await this.grantableMb(domain, accountId, inv.id);
    const held = (await this.delegations.findOne({ where: { accountId, domainId: domain.id } }))?.quotaMb ?? 0;
    const quotaMb = grantable === null ? inv.delegationQuotaMb : Math.max(0, Math.min(inv.delegationQuotaMb, grantable - held));
    await this.upsertRow(domain, accountId, inv.invitedBy, {
      maxRecipients: inv.delegationMaxRecipients,
      maxAliases: inv.delegationMaxAliases,
      quotaMb,
    });
  }

  async setCaps(domainId: number, accountId: string, caps: DelegationCapsDto) {
    const domain = await this.resolveDomain(domainId);
    const existing = await this.delegations.findOne({ where: { accountId, domainId } });
    if (!existing) throw new NotFoundException(`No delegation for account ${accountId} on domain #${domainId}`);
    await this.assertGrantFits(domain, accountId, caps.quotaMb);
    existing.maxRecipients = caps.maxRecipients;
    existing.maxAliases = caps.maxAliases;
    existing.quotaMb = caps.quotaMb;
    return this.delegations.save(existing);
  }

  async revoke(domainId: number, accountId: string): Promise<{ ok: true }> {
    const existing = await this.delegations.findOne({ where: { accountId, domainId } });
    if (!existing) throw new NotFoundException(`No delegation for account ${accountId} on domain #${domainId}`);
    await this.delegations.remove(existing);
    return { ok: true };
  }

  // Each row also carries the largest quota_mb its own edit form may set right
  // now (its current promise excluded from the sum), and the payload the max a
  // brand new grant may take. Null = unlimited domain.
  async listForDomain(domainId: number) {
    const domain = await this.resolveDomain(domainId);
    const rows = await this.delegations.find({ where: { domainId }, order: { createdAt: "ASC" } });
    const delegations = await Promise.all(
      rows.map(async (d) => ({
        accountId: d.accountId,
        accountEmail: (await this.accounts.findOne({ where: { id: d.accountId }, select: { email: true } }))?.email ?? null,
        maxRecipients: d.maxRecipients,
        maxAliases: d.maxAliases,
        quotaMb: d.quotaMb,
        usedRecipients: await this.usedRecipientsOf(d, domain.domain),
        usedAliases: await this.usedAliasesOf(d, domain.domain),
        usedBytes: String(await this.spentBytesOf(d, domain.domain)),
        grantableMb: await this.grantableMb(domain, d.accountId),
      }))
    );
    const pending = await this.pendingInvitationsOf(domainId);
    return {
      grantableMb: await this.grantableMb(domain, null),
      delegations,
      pendingInvitations: await Promise.all(
        pending.map(async (p) => ({
          id: p.id,
          email: p.email,
          note: p.note,
          token: p.email === null ? p.token : null,
          maxRecipients: p.delegationMaxRecipients,
          maxAliases: p.delegationMaxAliases,
          quotaMb: p.delegationQuotaMb ?? 0,
          expiresAt: p.expiresAt,
          grantableMb: await this.grantableMb(domain, null, p.id),
        }))
      ),
    };
  }

  async myDelegations(accountId: string) {
    const rows = await this.delegations.find({ where: { accountId }, order: { domainId: "ASC" } });
    return Promise.all(
      rows.map(async (d) => {
        const domain = await this.domains.findOne({ where: { id: d.domainId } });
        const fqdn = domain?.domain ?? "";
        return {
          domainId: d.domainId,
          domain: fqdn,
          maxRecipients: d.maxRecipients,
          maxAliases: d.maxAliases,
          quotaMb: d.quotaMb,
          usedRecipients: await this.usedRecipientsOf(d, fqdn),
          usedAliases: await this.usedAliasesOf(d, fqdn),
          usedBytes: String(await this.spentBytesOf(d, fqdn)),
        };
      })
    );
  }

  async assertCanCreateRecipient(accountId: string, domainId: number, quotaBytes: number): Promise<DomainDelegation> {
    const domain = await this.resolveDomain(domainId);
    const delegation = await this.delegations.findOne({ where: { accountId, domainId } });
    if (!delegation) {
      throw new ApiError(HttpStatus.FORBIDDEN, "delegations.noDelegation", "No delegation on this domain", { domainId });
    }
    if (delegation.maxRecipients !== null) {
      const count = await this.usedRecipientsOf(delegation, domain.domain);
      if (count >= delegation.maxRecipients) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "delegations.recipientCapReached", "Recipient cap reached", {
          max: delegation.maxRecipients,
        });
      }
    }
    const used = await this.spentBytesOf(delegation, domain.domain);
    if (used + quotaBytes > delegation.quotaMb * MB) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "delegations.reserveExceeded", "Granted quota exceeded", {
        reservedMb: delegation.quotaMb,
        usedMb: Math.ceil(used / MB),
        requestedMb: Math.ceil(quotaBytes / MB),
      });
    }
    return delegation;
  }

  // Raising the quota of a mailbox the delegate already owns spends the
  // delegation budget exactly like creating one: the extra bytes must fit in
  // the granted quota. Lowering frees budget and only needs the delegation to
  // exist. This is what makes a 0-mailbox grant with quota consumable.
  async assertCanRaiseQuota(accountId: string, domainFqdn: string, deltaBytes: number): Promise<void> {
    const domain = await this.domains.findOne({ where: { domain: domainFqdn } });
    if (!domain) throw new NotFoundException(`Domain ${domainFqdn} not found`);
    const delegation = await this.delegations.findOne({ where: { accountId, domainId: domain.id } });
    if (!delegation) {
      throw new ApiError(HttpStatus.FORBIDDEN, "delegations.noDelegation", "No delegation on this domain", {
        domainId: domain.id,
      });
    }
    if (deltaBytes <= 0) return;
    const used = await this.spentBytesOf(delegation, domainFqdn);
    if (used + deltaBytes > delegation.quotaMb * MB) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "delegations.reserveExceeded", "Granted quota exceeded", {
        reservedMb: delegation.quotaMb,
        usedMb: Math.ceil(used / MB),
        requestedMb: Math.ceil(deltaBytes / MB),
      });
    }
  }

  async assertCanCreateAlias(accountId: string, domainId: number): Promise<DomainDelegation> {
    const domain = await this.resolveDomain(domainId);
    const delegation = await this.delegations.findOne({ where: { accountId, domainId } });
    if (!delegation) {
      throw new ApiError(HttpStatus.FORBIDDEN, "delegations.noDelegation", "No delegation on this domain", { domainId });
    }
    if (delegation.maxAliases !== null) {
      const count = await this.usedAliasesOf(delegation, domain.domain);
      if (count >= delegation.maxAliases) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "delegations.aliasCapReached", "Alias cap reached", {
          max: delegation.maxAliases,
        });
      }
    }
    return delegation;
  }
}
