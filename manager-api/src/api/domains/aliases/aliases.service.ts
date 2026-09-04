import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import { ApiError } from "../../../core/common/api-error";
import { resolveSearchColumn, resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { Account } from "../../../core/entities/account.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CreateAliasDto, UpdateAliasDto } from "./aliases.validation";

// postmaster@<domain> is provisioned automatically per domain and is never a
// real, ownable mailbox.
function isPostmaster(source: string, domain: string) {
  return source.toLowerCase() === `postmaster@${domain.toLowerCase()}`;
}

// `id` has no dedicated UI column/header but stays an accepted value since
// it's the existing default -- keeps `resolveSortColumn`'s fallback
// type-safe without a cast.
// `lastActivity` maps to `last_activity`, which carries `ON UPDATE
// current_timestamp()`: it is the row's last modification, not any mail
// activity. The column name is postfix legacy and stays as it is.
// `ownerEmail` isn't a real virtual_aliases column either: the table carries
// only `owner_id`, and sorting on that would order by uuid, which reads as
// random. It sorts on the joined account's address instead, see `list()`.
export const ALIASES_SORTABLE_COLUMNS = ["source", "destination", "ownerEmail", "lastActivity", "id"] as const;

// The columns a `searchBy` may name, which are exactly the three the free-text
// search spans when it names none.
export const ALIASES_SEARCHABLE_COLUMNS = ["source", "destination", "ownerEmail"] as const;

const ALIAS_SEARCH_EXPRESSIONS: Record<(typeof ALIASES_SEARCHABLE_COLUMNS)[number], string> = {
  source: "a.source LIKE :search",
  destination: "a.destination LIKE :search",
  ownerEmail: "o.email LIKE :search",
};

@Injectable()
export class AliasesService {
  constructor(
    @InjectRepository(VirtualAlias)
    private readonly aliases: Repository<VirtualAlias>,
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>
  ) {}

  async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain;
  }

  // Fetch an alias plus the email of its owning account (null if unowned), for
  // the domain-side owner field.
  async getWithOwner(id: number, domain: string) {
    const alias = await this.get(id, domain);
    const ownerEmail = alias.ownerId
      ? ((await this.accounts.findOne({ where: { id: alias.ownerId }, select: { email: true } }))?.email ?? null)
      : null;
    return { ...alias, ownerEmail };
  }

  // Assign this alias to an account. An alias belongs to at most one account, so
  // assigning one already owned is refused: it must be released first.
  // postmaster@<domain> can never be owned.
  async assignOwner(id: number, domain: string, ownerId: string) {
    const alias = await this.get(id, domain);
    if (isPostmaster(alias.source, domain)) {
      throw new ApiError(HttpStatus.FORBIDDEN, "aliases.postmasterUnassignable", "postmaster@ cannot be assigned to an account", {
        id,
      });
    }
    if (alias.ownerId) {
      throw new ApiError(HttpStatus.CONFLICT, "aliases.alreadyAssigned", `Alias #${id} is already assigned to an account`, {
        id,
      });
    }
    const account = await this.accounts.findOne({ where: { id: ownerId } });
    if (!account) throw new NotFoundException(`Account #${ownerId} not found`);
    alias.ownerId = ownerId;
    return this.aliases.save(alias);
  }

  // Release this alias's owner (set it back to empty). Always allowed.
  async clearOwner(id: number, domain: string) {
    const alias = await this.get(id, domain);
    alias.ownerId = null;
    return this.aliases.save(alias);
  }

  // `query.limit` absent = legacy unpaginated behavior, still relied on by
  // dashboard.vue and useDomainDashboard.ts (need every alias of a domain
  // for aggregation, not a page of 10).
  //
  // The paginated branch joins the owning account so every row carries the
  // address behind its `owner_id`, which the list column links to. The join is
  // what makes searching and sorting on that address possible at all: both have
  // to happen in SQL, before the page window is cut, and neither could read a
  // uuid.
  async list(domain: string, query: PaginationQuery) {
    if (query.limit === undefined) {
      return this.aliases.find({ where: { domain }, order: { source: "ASC" } });
    }

    const sortBy = resolveSortColumn(query.sortBy, ALIASES_SORTABLE_COLUMNS, "id");
    const dir = query.sortDir === "asc" ? "ASC" : "DESC";
    const qb = this.aliases
      .createQueryBuilder("a")
      .leftJoin(Account, "o", "o.id = a.ownerId")
      .addSelect("o.email", "ownerEmail")
      .where("a.domain = :domain", { domain });
    if (query.search) {
      const searchBy = resolveSearchColumn(query.searchBy, ALIASES_SEARCHABLE_COLUMNS);
      const expressions = searchBy ? [ALIAS_SEARCH_EXPRESSIONS[searchBy]] : Object.values(ALIAS_SEARCH_EXPRESSIONS);
      qb.andWhere(`(${expressions.join(" OR ")})`, { search: `%${query.search}%` });
    }

    const total = await qb.getCount();
    if (sortBy === "ownerEmail") qb.orderBy("ownerEmail", dir);
    else qb.orderBy(`a.${sortBy}`, dir);

    const { entities, raw } = await qb.skip(query.offset).take(query.limit).getRawAndEntities();
    const items = entities.map((entity, i) => ({
      ...entity,
      ownerEmail: (raw[i] as { ownerEmail?: string | null } | undefined)?.ownerEmail ?? null,
    }));
    return { items, total };
  }

  async get(id: number, domain: string) {
    const found = await this.aliases.findOne({ where: { id, domain } });
    if (!found) {
      throw new ApiError(HttpStatus.NOT_FOUND, "aliases.notFound", `Alias #${id} not found in ${domain}`, { id, domain });
    }
    return found;
  }

  // `virtual_aliases.source` is what postfix matches an incoming envelope
  // recipient against, so two rows sharing one source would make delivery
  // depend on row order. `excludeId` lets an alias keep its own source while
  // only its destination changes.
  private async assertSourceFree(source: string, excludeId?: number) {
    const where = excludeId === undefined ? { source } : { source, id: Not(excludeId) };
    if (await this.aliases.findOne({ where })) {
      throw new ApiError(HttpStatus.CONFLICT, "aliases.alreadyExists", `Alias ${source} already exists`, { source });
    }
  }

  async create(input: CreateAliasDto, domain: string, opts: { ownerId?: string } = {}) {
    const source = `${input.localPart}@${domain}`;
    await this.assertSourceFree(source);
    return this.aliases.save(
      this.aliases.create({
        source,
        destination: input.destination,
        domain,
        ownerId: opts.ownerId ?? null,
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
  }

  // The new source is composed from the route's domain, never from the body:
  // an alias cannot be moved to another domain through this route, only
  // renamed within its own (see aliases.validation.ts).
  async update(id: number, input: UpdateAliasDto, domain: string) {
    const current = await this.get(id, domain);
    if (input.localPart !== undefined) {
      const source = `${input.localPart}@${domain}`;
      await this.assertSourceFree(source, id);
      current.source = source;
    }
    if (input.destination !== undefined) current.destination = input.destination;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.aliases.save(current);
  }

  async remove(id: number, domain: string) {
    await this.aliases.remove(await this.get(id, domain));
    return { ok: true };
  }
}
