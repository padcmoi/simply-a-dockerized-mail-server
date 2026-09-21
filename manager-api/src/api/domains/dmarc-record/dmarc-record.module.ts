import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DmarcRecordController } from "./dmarc-record.controller";
import { DmarcRecordService } from "./dmarc-record.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain]), CustomPermissionGuardModule],
  controllers: [DmarcRecordController],
  providers: [DmarcRecordService],
})
export class DomainsDmarcRecordModule {}
