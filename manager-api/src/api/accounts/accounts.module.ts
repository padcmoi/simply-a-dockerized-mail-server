import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountInvitation } from "../../core/entities/account-invitation.entity";
import { Account } from "../../core/entities/account.entity";
import { Group } from "../../core/entities/group.entity";
import { MailerModule } from "../../core/mailer/mailer.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [TypeOrmModule.forFeature([Account, AccountInvitation, Group]), MailerModule],
  providers: [AccountsService],
  controllers: [AccountsController],
})
export class AccountsModule {}
