import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import { resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CreateAliasDto, UpdateAliasDto } from "./aliases.validation";

// `id` has no dedicated UI column/header but stays an accepted value since
// it's the existing default -- keeps `resolveSortColumn`'s fallback
// type-safe without a cast.
export const ALIASES_SORTABLE_COLUMNS = ["source", "destination", "id"] as const;

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
    if (!found) throw new NotFoundException(`Alias #${id} not found in ${domain}`);
    return found;
  }

  async create(input: CreateAliasDto, domain: string) {
    const source = `${input.localPart}@${domain}`;
    if (await this.aliases.findOne({ where: { source } })) {
      throw new ConflictException(`Alias ${source} already exists`);
    }
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

  async update(id: number, input: UpdateAliasDto, domain: string) {
    const current = await this.get(id, domain);
    if (input.destination !== undefined) current.destination = input.destination;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.aliases.save(current);
  }

  async remove(id: number, domain: string) {
    await this.aliases.remove(await this.get(id, domain));
    return { ok: true };
  }
}
