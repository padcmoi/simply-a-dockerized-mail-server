import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { SpfRecordController } from "./spf-record.controller";
import { SpfRecordService } from "./spf-record.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain]), CustomPermissionGuardModule],
  controllers: [SpfRecordController],
  providers: [SpfRecordService],
})
export class DomainsSpfRecordModule {}
