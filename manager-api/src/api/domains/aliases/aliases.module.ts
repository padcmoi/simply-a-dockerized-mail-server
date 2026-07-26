import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../../../core/entities/account.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { AliasesController } from "./aliases.controller";
import { AliasesService } from "./aliases.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualAlias, VirtualDomain, Account]), CustomPermissionGuardModule],
  providers: [AliasesService],
  controllers: [AliasesController],
})
export class DomainsAliasesModule {}
