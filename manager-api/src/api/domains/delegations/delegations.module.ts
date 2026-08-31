import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { Account } from "../../../core/entities/account.entity";
import { AccountInvitation } from "../../../core/entities/account-invitation.entity";
import { DomainDelegation } from "../../../core/entities/domain-delegation.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { MailerModule } from "../../../core/mailer/mailer.module";
import { SettingsModule } from "../../../core/settings/settings.module";
import { DelegationsController } from "./delegations.controller";
import { DelegationsService } from "./delegations.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([DomainDelegation, VirtualDomain, VirtualUser, VirtualAlias, Account, AccountInvitation]),
    CustomPermissionGuardModule,
    MailerModule,
    SettingsModule,
  ],
  providers: [DelegationsService],
  controllers: [DelegationsController],
  exports: [DelegationsService],
})
export class DomainsDelegationsModule {}
