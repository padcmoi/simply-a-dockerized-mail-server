import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../../core/entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { GetDomainQuotasDocs, QuotasApi } from "./quotas.openapi";

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

  @Get()
  @RequireDomainPermissions([{ resource: "quotas", actions: ["access", "read"] }])
  @GetDomainQuotasDocs()
  async snapshot(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.resolveDomain(domainId);
    const [aggregate, recipients] = await Promise.all([
      this.domainQuotas.findOne({ where: { domain } }),
      this.recipientQuotas.find({ where: { domain }, order: { email: "ASC" } }),
    ]);
    return { domain: aggregate, recipients };
  }
}
