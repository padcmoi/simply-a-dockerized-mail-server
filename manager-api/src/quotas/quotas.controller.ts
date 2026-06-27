import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualQuotaDomain } from "./virtual-quota-domain.entity";
import { VirtualQuotaUser } from "./virtual-quota-user.entity";

@ApiTags("quotas")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller("quotas")
export class QuotasController {
  constructor(
    @InjectRepository(VirtualQuotaDomain) private readonly domains: Repository<VirtualQuotaDomain>,
    @InjectRepository(VirtualQuotaUser) private readonly users: Repository<VirtualQuotaUser>
  ) {}

  @Get("domains") listDomains() {
    return this.domains.find({ order: { domain: "ASC" } });
  }

  @Get("users") listUsers(@Query("domain") domain?: string) {
    return this.users.find({ where: domain ? { domain } : {}, order: { email: "ASC" } });
  }
}
