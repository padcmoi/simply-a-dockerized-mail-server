import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AclModule } from "../../core/acl/acl.module";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { AccountInvitation } from "../../core/entities/account-invitation.entity";
import { Account } from "../../core/entities/account.entity";
import { AccountProfile } from "../../core/entities/account-profile.entity";
import { GroupMember } from "../../core/entities/group-member.entity";
import { Group } from "../../core/entities/group.entity";
import { MailerModule } from "../../core/mailer/mailer.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, AccountProfile, AccountInvitation, Group, GroupMember]),
    MailerModule,
    CustomPermissionGuardModule,
    AclModule,
  ],
  providers: [AccountsService],
  controllers: [AccountsController],
})
export class AccountsModule {}
