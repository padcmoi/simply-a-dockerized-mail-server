import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BackupFile } from "../entities/backup-file.entity";
import { BackupRun } from "../entities/backup-run.entity";
import { BackupConfigService } from "./backup-config.service";
import { BackupRetrievalService } from "./backup-retrieval.service";
import { BackupService } from "./backup.service";

@Module({
  imports: [TypeOrmModule.forFeature([BackupRun, BackupFile])],
  providers: [BackupService, BackupConfigService, BackupRetrievalService],
  exports: [BackupService, BackupConfigService, BackupRetrievalService],
})
export class BackupModule {}
