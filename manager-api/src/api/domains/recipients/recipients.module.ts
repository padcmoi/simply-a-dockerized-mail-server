import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { RecipientsController } from "./recipients.controller";
import { RecipientsService } from "./recipients.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualUser, VirtualDomain, VirtualQuotaUser]), CustomPermissionGuardModule],
  providers: [RecipientsService],
  controllers: [RecipientsController],
  exports: [RecipientsService],
})
export class DomainsRecipientsModule {}
