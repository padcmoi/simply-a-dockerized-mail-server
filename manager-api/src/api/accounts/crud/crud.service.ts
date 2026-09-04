import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, Repository } from "typeorm";
import { ApiError } from "../../../core/common/api-error";
import { resolveSearchColumn, resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { Account } from "../../../core/entities/account.entity";
import { ACCOUNT_GENDERS, AccountProfile, composeDisplayName } from "../../../core/entities/account-profile.entity";
import { GroupMember } from "../../../core/entities/group-member.entity";
import { Group } from "../../../core/entities/group.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { GeocodingService } from "../../../core/geocoding/geocoding.service";
import { TwoFactorService } from "../../../core/auth/two-factor/two-factor.service";
import type { UpdateAccountDto } from "./crud.validation";

// `group` (enriched post-query, see `enrichWithGroups`) isn't a real column
// on `accounts` -- not sortable without a join/subquery, out of scope here.
// `displayName` is composed from the joined account_profiles name columns (see ACCOUNTS_SORT_EXPR).
export const ACCOUNTS_SORTABLE_COLUMNS = ["email", "displayName", "enabled", "createdAt"] as const;

// Maps each sortable key to its real SQL expression (account column or the
// joined profile column), so a whitelisted key never reaches ORDER BY raw.
// Values are entity-property paths (alias.property), NOT db column names --
// TypeORM resolves them to columns; a snake_case db name (a.created_at) makes it
// throw "Cannot read properties of undefined (reading 'databaseName')".
// `displayName` is no longer a stored column: it is composed from the profile's
// last + first name, so its sort orders on those two columns in that order.
const ACCOUNTS_SORT_EXPR: Record<(typeof ACCOUNTS_SORTABLE_COLUMNS)[number], string[]> = {
  email: ["a.email"],
  displayName: ["p.lastName", "p.firstName"],
  enabled: ["a.enabled"],
  createdAt: ["a.createdAt"],
};

// The columns a `searchBy` may name, matching the two the free-text search
// spans when it names none. `displayName` is the joined pair of name columns,
// concatenated so "jean dupont" matches across both.
export const ACCOUNTS_SEARCHABLE_COLUMNS = ["email", "displayName"] as const;

const ACCOUNTS_SEARCH_EXPR: Record<(typeof ACCOUNTS_SEARCHABLE_COLUMNS)[number], string> = {
  email: "a.email LIKE :s",
  displayName: "CONCAT_WS(' ', p.first_name, p.last_name) LIKE :s",
};

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    private readonly geocoding: GeocodingService,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser) private readonly virtualUsers: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>,
    private readonly twoFactor: TwoFactorService
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
      .addSelect("NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), '')", "displayName")
      .orderBy("a.email", "ASC");
    if (opts.notInGroup) {
      qb.leftJoin(GroupMember, "gm", "gm.account_id = a.id AND gm.group_id = :gid", { gid: opts.notInGroup }).andWhere(
        "gm.id IS NULL"
      );
    }
    if (opts.search) {
      qb.andWhere("(a.email LIKE :s OR CONCAT_WS(' ', p.first_name, p.last_name) LIKE :s)", { s: `%${opts.search}%` });
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

    // Joins account_profiles so search and sort can reach the name, which does
    // not live on `accounts`. addSelect keeps the name columns in the pagination
    // DISTINCT subquery getManyAndCount builds, so ORDER BY on them resolves
    // (otherwise: Unknown column 'distinctAlias.p_last_name').
    const qb = this.accounts
      .createQueryBuilder("a")
      .leftJoin(AccountProfile, "p", "p.account_id = a.id")
      .addSelect("p.firstName")
      .addSelect("p.lastName");
    if (query.search) {
      const searchBy = resolveSearchColumn(query.searchBy, ACCOUNTS_SEARCHABLE_COLUMNS);
      const expressions = searchBy ? [ACCOUNTS_SEARCH_EXPR[searchBy]] : Object.values(ACCOUNTS_SEARCH_EXPR);
      qb.andWhere(`(${expressions.join(" OR ")})`, { s: `%${query.search}%` });
    }
    const sortBy = resolveSortColumn(query.sortBy, ACCOUNTS_SORTABLE_COLUMNS, "createdAt");
    const dir = query.sortDir === "asc" ? "ASC" : "DESC";
    ACCOUNTS_SORT_EXPR[sortBy].forEach((expr, i) => (i === 0 ? qb.orderBy(expr, dir) : qb.addOrderBy(expr, dir)));
    qb.skip(query.offset).take(query.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { items: await this.enrichWithGroups(rows), total };
  }

  private async enrichWithGroups(allAccounts: Account[]) {
    const accountIds = allAccounts.map((acc) => acc.id);
    const [memberRows, profileRows] = await Promise.all([
      accountIds.length ? this.groupMembers.find({ where: { accountId: In(accountIds) } }) : [],
      accountIds.length ? this.profiles.find({ where: { accountId: In(accountIds) } }) : [],
    ]);
    const displayByAccount = new Map(profileRows.map((p) => [p.accountId, composeDisplayName(p.firstName, p.lastName)]));
    const avatarByAccount = new Map(profileRows.map((p) => [p.accountId, p.avatarUrl ?? null]));
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
      // The profiles are already loaded for the name, so the avatar rides along:
      // a list showing initials for an account that has a picture is a list that
      // looks like it lost the picture.
      avatarUrl: avatarByAccount.get(acc.id) ?? null,
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
      displayName: composeDisplayName(profile?.firstName, profile?.lastName),
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      gender: profile?.gender ?? null,
      genders: ACCOUNT_GENDERS,
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
      twoFactorEnabled: await this.twoFactor.isEnabled(id),
      groups: await this.accountGroups(id),
    };
  }

  // An administrator removing the second factor of an account that can no
  // longer produce a code: no code is asked, which is the whole point, and the
  // permission it takes is the one that edits the account.
  async resetTwoFactor(id: string) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    return this.twoFactor.reset(id);
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
      "firstName",
      "lastName",
      "gender",
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
    const [domains, recipients, aliases] = await Promise.all([
      this.domains.find({ where: { ownerId: id }, order: { domain: "ASC" } }),
      this.virtualUsers.find({ where: { ownerId: id }, order: { email: "ASC" } }),
      this.aliases.find({ where: { ownerId: id }, order: { source: "ASC" } }),
    ]);
    return {
      account,
      domains: domains.map((d) => ({ id: d.id, domain: d.domain, active: d.active === 1, quota: d.quota })),
      recipients: recipients.map((r) => ({ id: r.id, email: r.email, domain: r.domain, active: r.active === 1, quota: r.quota })),
      aliases: aliases.map((a) => ({ id: a.id, source: a.source, destination: a.destination, domain: a.domain })),
    };
  }

  // Hard delete. Rows that belong to the account (profile, presence, sessions,
  // group memberships, notifications, preferences, API tokens, read receipts) go
  // with it by ON DELETE CASCADE; references that outlive it (owned domains and
  // recipients, authored tickets and messages, group ownership, audit entries,
  // invitations sent) are ON DELETE SET NULL, so the account vanishes without
  // taking those records down. A root account is never deletable here.
  async deleteAccount(id: string) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    if (account.isRoot === 1) throw new BadRequestException("Cannot delete a root account");
    await this.accounts.delete({ id });
    return { ok: true };
  }

  private async assertAccount(accountId: string) {
    if (!(await this.accounts.findOne({ where: { id: accountId } }))) {
      throw new NotFoundException(`Account #${accountId} not found`);
    }
  }

  private async domainIdByName(names: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(names)];
    if (!unique.length) return new Map();
    const rows = await this.domains.find({ where: { domain: In(unique) }, select: { id: true, domain: true } });
    return new Map(rows.map((d) => [d.domain, d.id]));
  }

  // The recipients this account owns.
  async ownedRecipients(accountId: string) {
    await this.assertAccount(accountId);
    const rows = await this.virtualUsers.find({ where: { ownerId: accountId }, order: { email: "ASC" } });
    const idByName = await this.domainIdByName(rows.map((r) => r.domain));
    return rows.map((r) => ({ id: r.id, email: r.email, domain: r.domain, domainId: idByName.get(r.domain) ?? null }));
  }

  async ownedAliases(accountId: string) {
    await this.assertAccount(accountId);
    const rows = await this.aliases.find({ where: { ownerId: accountId }, order: { source: "ASC" } });
    const idByName = await this.domainIdByName(rows.map((r) => r.domain));
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      destination: r.destination,
      domain: r.domain,
      domainId: idByName.get(r.domain) ?? null,
    }));
  }

  // Distinct domains that still have an unassigned resource of this kind (so the
  // account page can offer a domain filter for the picker). postmaster@ is never
  // ownable, so a domain whose only free mailbox is its postmaster is excluded.
  private async unassignedDomains(kind: "recipients" | "aliases"): Promise<{ id: number; domain: string }[]> {
    const repo = kind === "recipients" ? this.virtualUsers : this.aliases;
    const addr = kind === "recipients" ? "x.email" : "x.source";
    const rows = await repo
      .createQueryBuilder("x")
      .select("DISTINCT x.domain", "domain")
      .where("x.owner_id IS NULL")
      .andWhere(`LOWER(${addr}) NOT LIKE 'postmaster@%'`)
      .getRawMany<{ domain: string }>();
    const names = rows.map((r) => r.domain);
    if (!names.length) return [];
    return this.domains.find({ where: { domain: In(names) }, select: { id: true, domain: true }, order: { domain: "ASC" } });
  }

  // Unassigned recipients for the account picker: the domains that still have any
  // (for the selector) plus a capped, optionally domain- and search-filtered page.
  async assignableRecipients(domainId?: number, search?: string) {
    const domains = await this.unassignedDomains("recipients");
    const qb = this.virtualUsers
      .createQueryBuilder("r")
      .where("r.owner_id IS NULL")
      .andWhere("LOWER(r.email) NOT LIKE 'postmaster@%'");
    if (domainId !== undefined) {
      const picked = domains.find((d) => d.id === domainId);
      if (!picked) return { domains, items: [] };
      qb.andWhere("r.domain = :dn", { dn: picked.domain });
    }
    if (search) qb.andWhere("r.email LIKE :s", { s: `%${search}%` });
    const rows = await qb.orderBy("r.email", "ASC").take(25).getMany();
    const idByName = new Map(domains.map((d) => [d.domain, d.id]));
    const items = rows.map((r) => ({ id: r.id, email: r.email, domain: r.domain, domainId: idByName.get(r.domain) ?? null }));
    return { domains, items };
  }

  async assignableAliases(domainId?: number, search?: string) {
    const domains = await this.unassignedDomains("aliases");
    const qb = this.aliases
      .createQueryBuilder("a")
      .where("a.owner_id IS NULL")
      .andWhere("LOWER(a.source) NOT LIKE 'postmaster@%'");
    if (domainId !== undefined) {
      const picked = domains.find((d) => d.id === domainId);
      if (!picked) return { domains, items: [] };
      qb.andWhere("a.domain = :dn", { dn: picked.domain });
    }
    if (search) qb.andWhere("(a.source LIKE :s OR a.destination LIKE :s)", { s: `%${search}%` });
    const rows = await qb.orderBy("a.source", "ASC").take(25).getMany();
    const idByName = new Map(domains.map((d) => [d.domain, d.id]));
    const items = rows.map((r) => ({
      id: r.id,
      source: r.source,
      destination: r.destination,
      domain: r.domain,
      domainId: idByName.get(r.domain) ?? null,
    }));
    return { domains, items };
  }

  // Attach an unassigned recipient/alias to this account, or detach one it owns.
  // The account side manages ownership globally; `owner_id` is the single source.
  async attachRecipient(accountId: string, recipientId: number) {
    await this.assertAccount(accountId);
    const recipient = await this.virtualUsers.findOne({ where: { id: recipientId } });
    if (!recipient) throw new NotFoundException(`Recipient #${recipientId} not found`);
    if (recipient.email.toLowerCase().startsWith("postmaster@")) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "recipients.postmasterUnassignable",
        "postmaster@ cannot be assigned to an account",
        { id: recipientId }
      );
    }
    if (recipient.ownerId)
      throw new ApiError(HttpStatus.CONFLICT, "recipients.alreadyAssigned", `Recipient #${recipientId} is already assigned`, {
        id: recipientId,
      });
    recipient.ownerId = accountId;
    return this.virtualUsers.save(recipient);
  }

  async detachRecipient(accountId: string, recipientId: number) {
    const recipient = await this.virtualUsers.findOne({ where: { id: recipientId, ownerId: accountId } });
    if (!recipient) throw new NotFoundException(`Recipient #${recipientId} not owned by account #${accountId}`);
    recipient.ownerId = null;
    return this.virtualUsers.save(recipient);
  }

  async attachAlias(accountId: string, aliasId: number) {
    await this.assertAccount(accountId);
    const alias = await this.aliases.findOne({ where: { id: aliasId } });
    if (!alias) throw new NotFoundException(`Alias #${aliasId} not found`);
    if (alias.source.toLowerCase().startsWith("postmaster@")) {
      throw new ApiError(HttpStatus.FORBIDDEN, "aliases.postmasterUnassignable", "postmaster@ cannot be assigned to an account", {
        id: aliasId,
      });
    }
    if (alias.ownerId)
      throw new ApiError(HttpStatus.CONFLICT, "aliases.alreadyAssigned", `Alias #${aliasId} is already assigned`, {
        id: aliasId,
      });
    alias.ownerId = accountId;
    return this.aliases.save(alias);
  }

  async detachAlias(accountId: string, aliasId: number) {
    const alias = await this.aliases.findOne({ where: { id: aliasId, ownerId: accountId } });
    if (!alias) throw new NotFoundException(`Alias #${aliasId} not owned by account #${accountId}`);
    alias.ownerId = null;
    return this.aliases.save(alias);
  }
}
