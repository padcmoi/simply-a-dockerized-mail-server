import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import { paginationQuerySchema, resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../../core/entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
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

  private async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain;
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
    const domain = await this.resolveDomain(domainId);
    const aggregate = await this.domainQuotas.findOne({ where: { domain } });

    if (query.limit === undefined) {
      const recipients = await this.recipientQuotas.find({ where: { domain }, order: { email: "ASC" } });
      return { domain: aggregate, recipients };
    }

    const where = query.search ? { domain, email: Like(`%${query.search}%`) } : { domain };
    const sortBy = resolveSortColumn(query.sortBy, QUOTAS_SORTABLE_COLUMNS, "id");
    const [items, total] = await this.recipientQuotas.findAndCount({
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit,
    });
    return { domain: aggregate, recipients: { items, total } };
  }
}
