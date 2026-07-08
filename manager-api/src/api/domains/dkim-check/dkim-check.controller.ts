import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { CheckDkimDocs, DkimCheckApi } from "./dkim-check.openapi";
import { DkimCheckService } from "./dkim-check.service";

@DkimCheckApi()
@Controller({ path: "domains/:domainId/dkim-check", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DkimCheckController {
  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    private readonly dkimCheck: DkimCheckService
  ) {}

  @Get()
  @RequireDomainPermissions([
    { resource: "dkim", actions: ["access", "read"] },
    { resource: "admin", actions: ["access", "read"] },
  ])
  @CheckDkimDocs()
  async check(@Param("domainId", ParseIntPipe) domainId: number) {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return this.dkimCheck.check(found.domain.toLowerCase());
  }
}
