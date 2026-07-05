import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { RspamdService } from "../../../core/rspamd/rspamd.service";
import { GetDomainSpamdHistoryDocs, GetDomainSpamdStatsDocs, SpamdApi } from "./spamd.openapi";

@SpamdApi()
@Controller({ path: "domains/:domainId/spamd", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DomainsSpamdController {
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
  @RequireDomainPermissions([{ resource: "spamd", actions: ["access", "read"] }])
  @GetDomainSpamdHistoryDocs()
  async history(@Param("domainId", ParseIntPipe) domainId: number, @Query("size") size?: string) {
    const fqdn = await this.resolveFqdn(domainId);
    return this.rspamd.history(fqdn, size ? parseInt(size, 10) : undefined);
  }

  @Get("stats")
  @RequireDomainPermissions([{ resource: "spamd", actions: ["access", "read"] }])
  @GetDomainSpamdStatsDocs()
  async stats(@Param("domainId", ParseIntPipe) domainId: number) {
    const fqdn = await this.resolveFqdn(domainId);
    const rows = await this.rspamd.history(fqdn);
    return {
      scanned: rows.length,
      rejected: rows.filter((r) => r.action === "reject").length,
      greylisted: rows.filter((r) => r.action === "greylist").length,
      clean: rows.filter((r) => r.action === "no action").length,
    };
  }
}
