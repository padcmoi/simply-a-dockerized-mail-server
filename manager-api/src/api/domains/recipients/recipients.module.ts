import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../../../core/entities/account.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { MailStorageModule } from "../../../core/mail-storage/mail-storage.module";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { DomainsDelegationsModule } from "../delegations/delegations.module";
import { RecipientsController } from "./recipients.controller";
import { RecipientsService } from "./recipients.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualUser, VirtualDomain, VirtualQuotaUser, Account]),
    CustomPermissionGuardModule,
    MailStorageModule,
    DomainsDelegationsModule,
  ],
  providers: [RecipientsService],
  controllers: [RecipientsController],
  exports: [RecipientsService],
})
export class DomainsRecipientsModule {}
