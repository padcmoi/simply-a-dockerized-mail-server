import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimKeyEntity } from "../../../core/entities/dkim-key.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { DeliverabilityController } from "./deliverability.controller";
import { DeliverabilityService } from "./deliverability.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain, DkimKeyEntity, VirtualUser, VirtualAlias]), CustomPermissionGuardModule],
  controllers: [DeliverabilityController],
  providers: [DeliverabilityService],
})
export class DomainsDeliverabilityModule {}
