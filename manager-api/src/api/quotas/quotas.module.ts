import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VirtualQuotaDomain } from "../../core/entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../../core/entities/virtual-quota-user.entity";
import { QuotasController } from "./quotas.controller";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualQuotaDomain, VirtualQuotaUser])],
  controllers: [QuotasController],
})
export class QuotasModule {}
