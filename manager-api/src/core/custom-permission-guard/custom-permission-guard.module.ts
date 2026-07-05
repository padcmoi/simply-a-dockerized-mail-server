import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../entities/account.entity";
import { GroupDomainPermission } from "../entities/group-domain-permission.entity";
import { GroupGlobalPermission } from "../entities/group-global-permission.entity";
import { Group } from "../entities/group.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { CustomPermissionGuardService } from "./custom-permission-guard.service";
import { DomainPermissionGuard } from "./domain-permission.guard";
import { GlobalPermissionGuard } from "./global-permission.guard";

@Module({
  imports: [TypeOrmModule.forFeature([Account, Group, GroupGlobalPermission, GroupDomainPermission, VirtualDomain])],
  providers: [CustomPermissionGuardService, GlobalPermissionGuard, DomainPermissionGuard],
  exports: [CustomPermissionGuardService, GlobalPermissionGuard, DomainPermissionGuard],
})
export class CustomPermissionGuardModule {}
