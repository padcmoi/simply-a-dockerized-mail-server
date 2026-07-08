import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import type { RspamdActions, RspamdDomainStats } from "../../../core/rspamd/rspamd.service";
import { RspamdService } from "../../../core/rspamd/rspamd.service";
import { DomainRspamdApi, GetDomainRspamdHistoryDocs, GetDomainRspamdStatsDocs } from "./rspamd.openapi";

@DomainRspamdApi()
@Controller({ path: "domains/:domainId/rspamd", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DomainsRspamdController {
  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    private readonly rspamd: RspamdService
  ) {}

  private async resolveFqdn(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain.toLowerCase();
  }

  @Get("history")
  @RequireDomainPermissions([{ resource: "rspamd", actions: ["access", "read"] }])
  @GetDomainRspamdHistoryDocs()
  async history(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Query("size") size: string | undefined,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    const fqdn = await this.resolveFqdn(domainId);
    return this.rspamd.history(fqdn, size ? parseInt(size, 10) : undefined, query);
  }

  @Get("stats")
  @RequireDomainPermissions([{ resource: "rspamd", actions: ["access", "read"] }])
  @GetDomainRspamdStatsDocs()
  async stats(@Param("domainId", ParseIntPipe) domainId: number): Promise<RspamdDomainStats> {
    const fqdn = await this.resolveFqdn(domainId);
    const rows = await this.rspamd.history(fqdn);
    const actions: RspamdActions = {
      reject: 0,
      "soft reject": 0,
      "rewrite subject": 0,
      "add header": 0,
      greylist: 0,
      "no action": 0,
    };
    for (const row of rows) {
      if (row.action in actions) actions[row.action as keyof RspamdActions]++;
    }
    return { scanned: rows.length, actions };
  }
}
