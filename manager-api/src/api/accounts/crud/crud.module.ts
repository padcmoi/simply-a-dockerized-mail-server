import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../../../core/entities/account.entity";
import { AccountProfile } from "../../../core/entities/account-profile.entity";
import { GroupMember } from "../../../core/entities/group-member.entity";
import { Group } from "../../../core/entities/group.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { GeocodingModule } from "../../../core/geocoding/geocoding.module";
import { TwoFactorModule } from "../../../core/auth/two-factor/two-factor.module";
import { AccountsController } from "./crud.controller";
import { AccountsService } from "./crud.service";

// Core account management (CRUD): list/view/edit/revoke and the account
// overview. Sessions and invitations are separate sibling modules; see
// accounts.module.ts (the aggregator).
@Module({
  imports: [
    TypeOrmModule.forFeature([Account, AccountProfile, Group, GroupMember, VirtualDomain, VirtualUser, VirtualAlias]),
    GeocodingModule,
    // The controller is guarded by GlobalPermissionGuard, which injects
    // CustomPermissionGuardService. That module is not @Global, so it must be
    // imported here for Nest to resolve the guard at boot (the CRUD service no
    // longer uses the ACL layer itself, but the controller's guard still does).
    CustomPermissionGuardModule,
    TwoFactorModule,
  ],
  providers: [AccountsService],
  controllers: [AccountsController],
})
export class AccountsCrudModule {}
