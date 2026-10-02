import { Module } from "@nestjs/common";
import { LoopbackGuard } from "../../core/auth/loopback.guard";
import { MailerModule } from "../../core/mailer/mailer.module";
import { SettingsModule } from "../../core/settings/settings.module";
import { BackupModule } from "../../core/backups/backup.module";
import { InternalAlertController } from "./internal-alert.controller";
import { InternalBackupController } from "./internal-backup.controller";

@Module({
  imports: [MailerModule, SettingsModule, BackupModule],
  controllers: [InternalAlertController, InternalBackupController],
  providers: [LoopbackGuard],
})
export class InternalApiModule {}
