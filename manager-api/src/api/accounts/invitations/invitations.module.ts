import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AclModule } from "../../../core/acl/acl.module";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { AccountInvitation } from "../../../core/entities/account-invitation.entity";
import { Account } from "../../../core/entities/account.entity";
import { AccountProfile } from "../../../core/entities/account-profile.entity";
import { Group } from "../../../core/entities/group.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { MailerModule } from "../../../core/mailer/mailer.module";
import { AccountsInvitationsController } from "./invitations.controller";
import { AccountsInvitationsService } from "./invitations.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountInvitation, Account, AccountProfile, Group, VirtualDomain]),
    MailerModule,
    CustomPermissionGuardModule,
    AclModule,
  ],
  providers: [AccountsInvitationsService],
  controllers: [AccountsInvitationsController],
})
export class AccountsInvitationsModule {}
