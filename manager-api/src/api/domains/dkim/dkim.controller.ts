import { Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DkimService } from "../../../core/dkim/dkim.service";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DkimApi, ListDkimDocs, RemoveDkimDocs, RotateDkimDocs } from "./dkim.openapi";

@DkimApi()
@Controller({ path: "domains/:domainId/dkim", version: "1" })
export class DkimController {
  constructor(
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    private readonly dkim: DkimService
  ) {}

  private async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain;
  }

  @Get()
  @ListDkimDocs()
  async list(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.resolveDomain(domainId);
    return this.dkim.list(domain);
  }

  @Post("rotate")
  @RotateDkimDocs()
  async rotate(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.resolveDomain(domainId);
    return this.dkim.create(domain);
  }

  @Delete(":selector")
  @RemoveDkimDocs()
  async remove(@Param("domainId", ParseIntPipe) domainId: number, @Param("selector") selector: string) {
    const domain = await this.resolveDomain(domainId);
    return this.dkim.remove(domain, selector);
  }
}
