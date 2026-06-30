import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../../core/entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
import { QuotasController } from "./quotas.controller";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain, VirtualQuotaDomain, VirtualQuotaUser])],
  controllers: [QuotasController],
})
export class DomainsQuotasModule {}
