import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Not, Repository } from "typeorm";
import { ApiError } from "../../../core/common/api-error";
import { resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CreateAliasDto, UpdateAliasDto } from "./aliases.validation";

// `id` has no dedicated UI column/header but stays an accepted value since
// it's the existing default -- keeps `resolveSortColumn`'s fallback
// type-safe without a cast.
// `lastActivity` maps to `last_activity`, which carries `ON UPDATE
// current_timestamp()`: it is the row's last modification, not any mail
// activity. The column name is postfix legacy and stays as it is.
export const ALIASES_SORTABLE_COLUMNS = ["source", "destination", "lastActivity", "id"] as const;

@Injectable()
export class AliasesService {
  constructor(
    @InjectRepository(VirtualAlias)
    private readonly aliases: Repository<VirtualAlias>,
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>
  ) {}

  async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain;
  }

  // `query.limit` absent = legacy unpaginated behavior, still relied on by
  // dashboard.vue and useDomainDashboard.ts (need every alias of a domain
  // for aggregation, not a page of 10).
  async list(domain: string, query: PaginationQuery) {
    if (query.limit === undefined) {
      return this.aliases.find({ where: { domain }, order: { source: "ASC" } });
    }
    const where = query.search
      ? [
          { domain, source: Like(`%${query.search}%`) },
          { domain, destination: Like(`%${query.search}%`) },
        ]
      : { domain };
    const sortBy = resolveSortColumn(query.sortBy, ALIASES_SORTABLE_COLUMNS, "id");
    const [items, total] = await this.aliases.findAndCount({
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit,
    });
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

  async create(input: CreateAliasDto, domain: string) {
    const source = `${input.localPart}@${domain}`;
    await this.assertSourceFree(source);
    return this.aliases.save(
      this.aliases.create({
        source,
        destination: input.destination,
        domain,
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
