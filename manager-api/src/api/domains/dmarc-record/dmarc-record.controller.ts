import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DmarcRecordApi, DmarcRecordDocs } from "./dmarc-record.openapi";
import { DmarcRecordService } from "./dmarc-record.service";

@DmarcRecordApi()
@Controller({ path: "domains/:domainId/dmarc-record", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DmarcRecordController {
  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    private readonly records: DmarcRecordService
  ) {}

  @Get()
  @RequireDomainPermissions([{ resource: "admin", actions: ["access", "view-admin-page"] }])
  @DmarcRecordDocs()
  async describe(@Param("domainId", ParseIntPipe) domainId: number) {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return this.records.describe(found.domain);
  }
}
