import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountDomainAcl } from "../../core/entities/account-domain-acl.entity";
import { AccountInvitation } from "../../core/entities/account-invitation.entity";
import { Account } from "../../core/entities/account.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { MailerModule } from "../../core/mailer/mailer.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [TypeOrmModule.forFeature([Account, AccountInvitation, AccountDomainAcl, VirtualDomain]), MailerModule],
  providers: [AccountsService],
  controllers: [AccountsController],
})
export class AccountsModule {}
