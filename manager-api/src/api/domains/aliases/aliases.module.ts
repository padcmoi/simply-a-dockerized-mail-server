import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../../../core/entities/account.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { AliasesController } from "./aliases.controller";
import { AliasesService } from "./aliases.service";
import { ActivityLogModule } from "../../../core/activity/activity-log.module";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualAlias, VirtualDomain, Account]), CustomPermissionGuardModule, ActivityLogModule],
  providers: [AliasesService],
  controllers: [AliasesController],
  exports: [AliasesService],
})
export class DomainsAliasesModule {}
