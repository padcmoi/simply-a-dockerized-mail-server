import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { SpfRecordApi, SpfRecordDocs } from "./spf-record.openapi";
import { SpfRecordService } from "./spf-record.service";

@SpfRecordApi()
@Controller({ path: "domains/:domainId/spf-record", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class SpfRecordController {
  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    private readonly records: SpfRecordService
  ) {}

  @Get()
  @RequireDomainPermissions([{ resource: "admin", actions: ["access", "view-admin-page"] }])
  @SpfRecordDocs()
  async describe(@Param("domainId", ParseIntPipe) domainId: number) {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return this.records.describe(found.domain);
  }
}
