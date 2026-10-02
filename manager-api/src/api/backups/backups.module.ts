import { Module } from "@nestjs/common";
import { ActivityLogModule } from "../../core/activity/activity-log.module";
import { BackupModule } from "../../core/backups/backup.module";
import { BackupDownloadController } from "./backup-download.controller";
import { BackupsController } from "./backups.controller";

@Module({
  imports: [BackupModule, ActivityLogModule],
  controllers: [BackupsController, BackupDownloadController],
})
export class BackupsApiModule {}
