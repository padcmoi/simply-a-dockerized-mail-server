import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RspamdCoreModule } from "../../../core/rspamd/rspamd.module";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { DomainsRspamdController } from "./rspamd.controller";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain, VirtualUser]), RspamdCoreModule, CustomPermissionGuardModule],
  controllers: [DomainsRspamdController],
})
export class DomainsRspamdModule {}
