import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimModule } from "../../core/dkim/dkim.module";
import { AccountDomainAcl } from "../../core/entities/account-domain-acl.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { DomainsAliasesModule } from "./aliases/aliases.module";
import { DomainsDkimModule } from "./dkim/dkim.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { DomainsQuotasModule } from "./quotas/quotas.module";
import { DomainsRecipientsModule } from "./recipients/recipients.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualDomain, VirtualUser, AccountDomainAcl]),
    DkimModule,
    DomainsRecipientsModule,
    DomainsAliasesModule,
    DomainsDkimModule,
    DomainsQuotasModule,
  ],
  providers: [DomainsService],
  controllers: [DomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
