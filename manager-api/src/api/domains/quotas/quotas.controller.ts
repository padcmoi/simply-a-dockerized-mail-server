import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { paginationQuerySchema, resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../../core/entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { GetDomainQuotasDocs, QUOTAS_SORTABLE_COLUMNS, QuotasApi } from "./quotas.openapi";

@QuotasApi()
@Controller({ path: "domains/:domainId/quotas", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class QuotasController {
  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualQuotaDomain)
    private readonly domainQuotas: Repository<VirtualQuotaDomain>,
    @InjectRepository(VirtualQuotaUser)
    private readonly recipientQuotas: Repository<VirtualQuotaUser>
  ) {}

  // Returns the row, not just its FQDN: the aggregate below needs its `quota`
  // to state consumption as a fraction of what the domain was granted.
  // virtual_quota_domains holds dovecot's counters and nothing else.
  private async resolveDomain(domainId: number): Promise<VirtualDomain> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found;
  }

  // dovecot's counters live in virtual_quota_users, the reservation in
  // virtual_users: neither table alone answers "how full is this mailbox".
  // Joined here rather than enriched afterwards, so `sortBy=quota` can order
  // the whole set before the page window is cut -- an in-memory sort would
  // only reorder within a page already picked by the wrong column.
  private recipientsQuery(domain: string) {
    return this.recipientQuotas
      .createQueryBuilder("q")
      .leftJoin(VirtualUser, "u", "u.email = q.email")
      .addSelect("COALESCE(u.quota, 0)", "quota")
      .where("q.domain = :domain", { domain });
  }

  // A recipient with no virtual_users row (deleted, its counters not yet
  // reaped) reads as quota 0 rather than dropping out of the list.
  private static withQuota(entities: VirtualQuotaUser[], raw: { quota?: string | number }[]) {
    return entities.map((entity, i) => ({ ...entity, quota: String(raw[i]?.quota ?? "0") }));
  }

  // `query.limit` absent = legacy unpaginated behavior: `recipients` stays a
  // bare array, still relied on by useDomainDashboard.ts (needs every
  // recipient's quota to compute the top-mailboxes widget).
  @Get()
  @RequireDomainPermissions([{ resource: "quotas", actions: ["access", "read"] }])
  @GetDomainQuotasDocs()
  async snapshot(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    const parent = await this.resolveDomain(domainId);
    const domain = parent.domain;
    const counters = await this.domainQuotas.findOne({ where: { domain } });
    // Null until dovecot writes its first aggregate row; the quota is known
    // either way, but there is no row to hang it on.
    const aggregate = counters ? { ...counters, quota: String(parent.quota) } : null;

    if (query.limit === undefined) {
      const { entities, raw } = await this.recipientsQuery(domain).orderBy("q.email", "ASC").getRawAndEntities();
      return { domain: aggregate, recipients: QuotasController.withQuota(entities, raw) };
    }

    const qb = this.recipientsQuery(domain);
    if (query.search) qb.andWhere("q.email LIKE :search", { search: `%${query.search}%` });

    const total = await qb.getCount();
    const sortBy = resolveSortColumn(query.sortBy, QUOTAS_SORTABLE_COLUMNS, "id");
    const dir = query.sortDir === "asc" ? "ASC" : "DESC";
    if (sortBy === "quota") qb.orderBy("quota", dir);
    else qb.orderBy(`q.${sortBy}`, dir);

    const { entities, raw } = await qb.skip(query.offset).take(query.limit).getRawAndEntities();
    return { domain: aggregate, recipients: { items: QuotasController.withQuota(entities, raw), total } };
  }
}
