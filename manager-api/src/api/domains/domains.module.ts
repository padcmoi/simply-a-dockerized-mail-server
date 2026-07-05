import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../core/audit/audit-log.module";
import { DkimModule } from "../../core/dkim/dkim.module";
import { Account } from "../../core/entities/account.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { DomainsAliasesModule } from "./aliases/aliases.module";
import { DomainsDkimModule } from "./dkim/dkim.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { DomainsQuotasModule } from "./quotas/quotas.module";
import { DomainsRecipientsModule } from "./recipients/recipients.module";
import { DomainsSpamdModule } from "./spamd/spamd.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualDomain, VirtualUser, Account]),
    CustomPermissionGuardModule,
    AuditLogModule,
    DkimModule,
    DomainsRecipientsModule,
    DomainsAliasesModule,
    DomainsDkimModule,
    DomainsQuotasModule,
    DomainsSpamdModule,
  ],
  providers: [DomainsService],
  controllers: [DomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
