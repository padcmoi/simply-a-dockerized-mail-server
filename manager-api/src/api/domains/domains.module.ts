import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../core/audit/audit-log.module";
import { DkimModule } from "../../core/dkim/dkim.module";
import { Account } from "../../core/entities/account.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../core/entities/virtual-quota-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { AdminDomainsController } from "./admin-domains/admin-domains.controller";
import { DomainsAliasesModule } from "./aliases/aliases.module";
import { DomainsDkimModule } from "./dkim/dkim.module";
import { DomainsDkimCheckModule } from "./dkim-check/dkim-check.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { DomainsQuotasModule } from "./quotas/quotas.module";
import { DomainsRecipientsModule } from "./recipients/recipients.module";
import { DomainsRspamdModule } from "./rspamd/rspamd.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualDomain, VirtualUser, Account, VirtualQuotaDomain]),
    CustomPermissionGuardModule,
    AuditLogModule,
    DkimModule,
    DomainsRecipientsModule,
    DomainsAliasesModule,
    DomainsDkimModule,
    DomainsDkimCheckModule,
    DomainsQuotasModule,
    DomainsRspamdModule,
  ],
  providers: [DomainsService],
  controllers: [DomainsController, AdminDomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
