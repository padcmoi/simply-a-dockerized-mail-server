import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { In, IsNull, Not, Repository } from "typeorm";
import { resolveSortColumn, type PaginationQuery } from "../../core/common/pagination.validation";
import { AntiEscalationService, type ActingUser } from "../../core/acl/anti-escalation.service";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
import { AccountInvitation } from "../../core/entities/account-invitation.entity";
import { Account } from "../../core/entities/account.entity";
import { AccountProfile } from "../../core/entities/account-profile.entity";
import { GroupMember } from "../../core/entities/group-member.entity";
import { Group } from "../../core/entities/group.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { GeocodingService } from "../../core/geocoding/geocoding.service";
import { MailerService } from "../../core/mailer/mailer.service";
import type { AcceptInvitationDto, SendInvitationDto, UpdateAccountDto } from "./accounts.validation";

// `group` (enriched post-query, see `enrichWithGroups`) isn't a real column
// on `accounts` -- not sortable without a join/subquery, out of scope here.
// `displayName` lives on the joined account_profiles table (see ACCOUNTS_SORT_EXPR).
export const ACCOUNTS_SORTABLE_COLUMNS = ["email", "displayName", "enabled", "createdAt"] as const;

// Maps each sortable key to its real SQL expression (account column or the
// joined profile column), so a whitelisted key never reaches ORDER BY raw.
// Values are entity-property paths (alias.property), NOT db column names --
// TypeORM resolves them to columns; a snake_case db name (a.created_at) makes it
// throw "Cannot read properties of undefined (reading 'databaseName')".
const ACCOUNTS_SORT_EXPR: Record<(typeof ACCOUNTS_SORTABLE_COLUMNS)[number], string> = {
  email: "a.email",
  displayName: "p.displayName",
  enabled: "a.enabled",
  createdAt: "a.createdAt",
};

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    @InjectRepository(AccountInvitation)
    private readonly invitations: Repository<AccountInvitation>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    private readonly mailer: MailerService,
    private readonly cpg: CustomPermissionGuardService,
    private readonly antiEscalation: AntiEscalationService,
    private readonly geocoding: GeocodingService,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser) private readonly virtualUsers: Repository<VirtualUser>
  ) {}

  // `notInGroup` (a group id) filters out accounts that are already members of
  // that group, so a group's "add member" picker only offers assignable
  // accounts. A left join to group_members keeping the rows with no match is the
  // non-member set. `search` (LIKE on username/name) + `limit` turn this into a
  // server-side typeahead: the picker never preloads the whole account table,
  // it fetches only the top `limit` matches per keystroke -- absent `limit`
  // keeps the legacy full list for the other callers (invite modal, pickers).
  async listNames(opts: { notInGroup?: string; search?: string; limit?: number } = {}) {
    const qb = this.accounts
      .createQueryBuilder("a")
      .leftJoin(AccountProfile, "p", "p.account_id = a.id")
      .select("a.id", "id")
      .addSelect("a.email", "email")
      .addSelect("p.displayName", "displayName")
      .orderBy("a.email", "ASC");
    if (opts.notInGroup) {
      qb.leftJoin(GroupMember, "gm", "gm.account_id = a.id AND gm.group_id = :gid", { gid: opts.notInGroup }).andWhere(
        "gm.id IS NULL"
      );
    }
    if (opts.search) {
      qb.andWhere("(a.email LIKE :s OR p.display_name LIKE :s)", { s: `%${opts.search}%` });
    }
    if (opts.limit !== undefined) qb.limit(opts.limit);
    const rows = await qb.getRawMany<{ id: string; email: string; displayName: string | null }>();
    return rows.map((r) => ({ id: r.id, email: r.email, displayName: r.displayName ?? null }));
  }

  // `query.limit` absent = legacy unpaginated behavior, relied on by no
  // other consumer today but kept for consistency with every other list
  // endpoint (see pagination.validation.ts).
  async list(query: PaginationQuery) {
    if (query.limit === undefined) {
      const allAccounts = await this.accounts.find({ order: { email: "ASC" } });
      return this.enrichWithGroups(allAccounts);
    }

    // Joins account_profiles so search and sort can reach the display name,
    // which no longer lives on `accounts`. addSelect keeps p.display_name in the
    // pagination DISTINCT subquery getManyAndCount builds, so ORDER BY on it
    // resolves (otherwise: Unknown column 'distinctAlias.p_display_name').
    const qb = this.accounts
      .createQueryBuilder("a")
      .leftJoin(AccountProfile, "p", "p.account_id = a.id")
      .addSelect("p.displayName");
    if (query.search) {
      qb.andWhere("(a.email LIKE :s OR p.display_name LIKE :s)", { s: `%${query.search}%` });
    }
    const sortBy = resolveSortColumn(query.sortBy, ACCOUNTS_SORTABLE_COLUMNS, "createdAt");
    qb.orderBy(ACCOUNTS_SORT_EXPR[sortBy], query.sortDir === "asc" ? "ASC" : "DESC")
      .skip(query.offset)
      .take(query.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { items: await this.enrichWithGroups(rows), total };
  }

  private async enrichWithGroups(allAccounts: Account[]) {
    const accountIds = allAccounts.map((acc) => acc.id);
    const [memberRows, profileRows] = await Promise.all([
      accountIds.length ? this.groupMembers.find({ where: { accountId: In(accountIds) } }) : [],
      accountIds.length ? this.profiles.find({ where: { accountId: In(accountIds) } }) : [],
    ]);
    const displayByAccount = new Map(profileRows.map((p) => [p.accountId, p.displayName]));
    const groupIds = [...new Set(memberRows.map((m) => m.groupId))];
    const groupMap = new Map<string, string>();
    if (groupIds.length) {
      const groupRows = await this.groups.findBy({ id: In(groupIds) });
      groupRows.forEach((g) => groupMap.set(g.id, g.name));
    }
    const groupsByAccount = new Map<string, { id: string; name: string }[]>();
    memberRows.forEach((m) => {
      const list = groupsByAccount.get(m.accountId) ?? [];
      list.push({ id: m.groupId, name: groupMap.get(m.groupId) ?? "" });
      groupsByAccount.set(m.accountId, list);
    });
    return allAccounts.map((acc) => ({
      id: acc.id,
      email: acc.email,
      displayName: displayByAccount.get(acc.id) ?? null,
      isRoot: acc.isRoot === 1,
      enabled: acc.enabled === 1,
      lastLogin: acc.lastLogin,
      createdAt: acc.createdAt,
      groups: groupsByAccount.get(acc.id) ?? [],
    }));
  }

  private async accountGroups(accountId: string) {
    const memberRows = await this.groupMembers.find({ where: { accountId } });
    if (!memberRows.length) return [];
    const groupRows = await this.groups.findBy({ id: In(memberRows.map((m) => m.groupId)) });
    return groupRows.map((g) => ({ id: g.id, name: g.name }));
  }

  async getById(id: string) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    const profile = await this.profiles.findOne({ where: { accountId: id } });
    return {
      id: account.id,
      email: account.email,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      phone: profile?.phone ?? null,
      addressLine: profile?.addressLine ?? null,
      addressComplement: profile?.addressComplement ?? null,
      city: profile?.city ?? null,
      postalCode: profile?.postalCode ?? null,
      country: profile?.country ?? null,
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
      isRoot: account.isRoot === 1,
      enabled: account.enabled === 1,
      lastLogin: account.lastLogin,
      createdAt: account.createdAt,
      groups: await this.accountGroups(id),
    };
  }

  // Admin-facing account edit: the full set of a user's editable fields. email
  // (login identity) and enabled are account-level; everything else is a profile
  // attribute on account_profiles, with `city`/`country` refreshing the geocoded
  // coordinates. Same field set an owner edits through PATCH /auth/jwt/me, plus
  // the admin-only enabled flag.
  async updateAccount(id: string, input: UpdateAccountDto) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    if (input.email !== undefined && input.email !== account.email) {
      const clash = await this.accounts.findOne({ where: { email: input.email, id: Not(id) } });
      if (clash) throw new ConflictException(`Email ${input.email} is already used by another account`);
      account.email = input.email;
    }
    if (input.enabled !== undefined) {
      if (account.isRoot === 1 && !input.enabled) throw new BadRequestException("Cannot disable a root account");
      account.enabled = input.enabled ? 1 : 0;
    }
    await this.accounts.save(account);

    const profileFields = [
      "displayName",
      "avatarUrl",
      "phone",
      "addressLine",
      "addressComplement",
      "city",
      "postalCode",
      "country",
    ] as const;
    const touchesProfile = profileFields.some((f) => input[f] !== undefined);
    if (touchesProfile) {
      const profile = (await this.profiles.findOne({ where: { accountId: id } })) ?? this.profiles.create({ accountId: id });
      for (const f of profileFields) {
        if (input[f] !== undefined) profile[f] = input[f] as never;
      }
      // Whenever the city (or country) is touched, refresh the coordinates: a set
      // city gets geocoded (best-effort; null coords if it fails), a cleared city
      // clears them. Kept in the same save so a profile never carries stale coords.
      if (input.city !== undefined || input.country !== undefined) {
        if (profile.city) {
          const coords = await this.geocoding.geocodeCity(profile.city, profile.country);
          profile.latitude = coords?.latitude ?? null;
          profile.longitude = coords?.longitude ?? null;
        } else {
          profile.latitude = null;
          profile.longitude = null;
        }
      }
      await this.profiles.save(profile);
    }
    return this.getById(id);
  }

  // Account overview (the intermediate dashboard page): the account itself plus
  // everything it owns across the mail stack. Domains and recipients both carry
  // a plain `owner_id` FK to accounts, so "belongs to this account" is a direct
  // filter on each table -- no join through the ACL layer. Reuses getById so the
  // 404 and the account shape (groups included) stay identical to GET /:id.
  async getOverview(id: string) {
    const account = await this.getById(id);
    const [domains, recipients] = await Promise.all([
      this.domains.find({ where: { ownerId: id }, order: { domain: "ASC" } }),
      this.virtualUsers.find({ where: { ownerId: id }, order: { email: "ASC" } }),
    ]);
    return {
      account,
      domains: domains.map((d) => ({ id: d.id, domain: d.domain, active: d.active === 1, quota: d.quota })),
      recipients: recipients.map((r) => ({ id: r.id, email: r.email, domain: r.domain, active: r.active === 1, quota: r.quota })),
    };
  }

  async revokeAccount(id: string) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    if (account.isRoot === 1) throw new BadRequestException("Cannot revoke a root account");
    account.enabled = 0;
    await this.accounts.save(account);
    return { ok: true };
  }

  async sendInvitation(actingUser: ActingUser, input: SendInvitationDto) {
    const existing = await this.invitations.findOne({
      where: { email: input.email, acceptedAt: IsNull() },
    });
    if (existing && existing.expiresAt > new Date()) {
      existing.expiresAt = new Date();
      await this.invitations.save(existing);
    }

    let group: Group | null = null;
    if (input.groupId) {
      group = await this.groups.findOne({ where: { id: input.groupId } });
      if (!group) throw new NotFoundException(`Group #${input.groupId} not found`);
      // Anti-escalade: accepting this invitation assigns the chosen group to the
      // new account (see acceptInvitation), granting its permissions by union. A
      // non-root inviter may therefore only invite into a group whose permissions
      // it already holds in full, otherwise `invite-account` alone would mint an
      // account more powerful than the inviter (e.g. straight into "admin"). Only
      // an explicitly chosen group is checked: the default-group fallback below is
      // the system floor every account gets via onAccountCreated anyway.
      const [groupGlobal, groupDomain] = await Promise.all([
        this.cpg.guard.findGroupGlobalPermissions(group.id),
        this.cpg.guard.findGroupDomainPermissions(group.id),
      ]);
      await this.antiEscalation.assertActingUserHolds(actingUser, groupGlobal, groupDomain);
    } else {
      group = await this.groups.findOne({ where: { isDefault: 1 } });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.invitations.save(
      this.invitations.create({
        token,
        email: input.email,
        invitedBy: actingUser.id,
        groupId: group?.id ?? null,
        expiresAt,
      })
    );

    const uiUrl = (process.env.MANAGER_UI_URL ?? "http://localhost").replace(/\/$/, "");
    await this.mailer.sendInvitation(input.email, `${uiUrl}/invite/${token}`, group?.name ?? null);
    return { ok: true };
  }

  async getInvitation(token: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    let groupName: string | null = null;
    if (inv.groupId !== null) {
      const group = await this.groups.findOne({ where: { id: inv.groupId } });
      groupName = group?.name ?? null;
    }
    return { email: inv.email, groupName, expiresAt: inv.expiresAt };
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
    if (inv.groupId !== null) {
      await this.cpg.guard.assignAccountToGroup(account.id, inv.groupId);
    }
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    return { ok: true, email: account.email };
  }
}
