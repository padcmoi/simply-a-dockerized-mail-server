import { Controller, Get, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualQuotaDomain } from "../../core/entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../../core/entities/virtual-quota-user.entity";
import { ListDomainQuotasDocs, ListUserQuotasDocs, QuotasApi } from "./quotas.openapi";

@QuotasApi()
@Controller("quotas")
export class QuotasController {
  constructor(
    @InjectRepository(VirtualQuotaDomain) private readonly domains: Repository<VirtualQuotaDomain>,
    @InjectRepository(VirtualQuotaUser) private readonly users: Repository<VirtualQuotaUser>
  ) {}

  @Get("domains")
  @ListDomainQuotasDocs()
  listDomains() {
    return this.domains.find({ order: { domain: "ASC" } });
  }

  @Get("users")
  @ListUserQuotasDocs()
  listUsers(@Query("domain") domain?: string) {
    return this.users.find({ where: domain ? { domain } : {}, order: { email: "ASC" } });
  }
}
