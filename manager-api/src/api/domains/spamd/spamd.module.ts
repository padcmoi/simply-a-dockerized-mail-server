import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RspamdCoreModule } from "../../../core/rspamd/rspamd.module";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DomainsSpamdController } from "./spamd.controller";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain]), RspamdCoreModule],
  controllers: [DomainsSpamdController],
})
export class DomainsSpamdModule {}
