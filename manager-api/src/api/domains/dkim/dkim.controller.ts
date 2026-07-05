import { Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DkimService } from "../../../core/dkim/dkim.service";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { DkimApi, ListDkimDocs, RemoveDkimDocs, RotateDkimDocs } from "./dkim.openapi";

@DkimApi()
@Controller({ path: "domains/:domainId/dkim", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DkimController {
  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    private readonly dkim: DkimService
  ) {}

  private async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain.toLowerCase();
  }

  @Get()
  @RequireDomainPermissions([{ resource: "dkim", actions: ["access", "read"] }])
  @ListDkimDocs()
  async list(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.resolveDomain(domainId);
    return this.dkim.list(domain);
  }

  @Post("rotate")
  @RequireDomainPermissions([{ resource: "dkim", actions: ["access", "create"] }])
  @RotateDkimDocs()
  async rotate(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.resolveDomain(domainId);
    await this.dkim.removeAll(domain).catch(() => undefined);
    return this.dkim.create(domain);
  }

  @Delete(":selector")
  @RequireDomainPermissions([{ resource: "dkim", actions: ["access", "delete"] }])
  @RemoveDkimDocs()
  async remove(@Param("domainId", ParseIntPipe) domainId: number, @Param("selector") selector: string) {
    const domain = await this.resolveDomain(domainId);
    return this.dkim.remove(domain, selector);
  }
}
