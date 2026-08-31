import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import {
  RequireDomainPermissions,
  RequireGlobalPermissions,
} from "../../../core/custom-permission-guard/require-permissions.decorator";
import { DeliverabilityApi, RunDeliverabilityDocs } from "./deliverability.openapi";
import { DeliverabilityService } from "./deliverability.service";

// Two gates, because two different questions are being asked. MAY YOU RUN THIS
// AT ALL is global: a run opens an SMTP session, fetches an HTTPS policy and
// queries public blocklists in this deployment's name, which is a cost and a
// footprint belonging to the installation rather than to a domain. ON WHICH
// DOMAIN is the per-domain question, and `domain:access` answers it: whoever
// may see the domain may diagnose it.
@DeliverabilityApi()
@Controller({ path: "domains/:domainId/deliverability", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DeliverabilityController {
  constructor(
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    private readonly deliverability: DeliverabilityService
  ) {}

  @Get()
  @RequireGlobalPermissions([{ resource: "deliverability", actions: ["access", "run-diagnostics"] }])
  @RequireDomainPermissions([{ resource: "domain", actions: ["access"] }])
  @RunDeliverabilityDocs()
  // One route, because reading the stored report and producing a new one are the
  // same question asked twice: what is the state of this domain. `refresh=true`
  // is what the re-run button sends, and it is the only thing that spends an
  // SMTP session and a round of blocklist queries.
  async run(@Param("domainId", ParseIntPipe) domainId: number, @Query("refresh") refresh?: string) {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return this.deliverability.report(found.domain.toLowerCase(), refresh === "true");
  }
}
