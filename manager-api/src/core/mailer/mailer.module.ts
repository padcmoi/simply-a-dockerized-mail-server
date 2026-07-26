import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailSetting } from "../entities/mail-setting.entity";
import { MailSettingsService } from "./mail-settings.service";
import { MailerService } from "./mailer.service";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [TypeOrmModule.forFeature([MailSetting]), SettingsModule],
  providers: [MailerService, MailSettingsService],
  exports: [MailerService, MailSettingsService],
})
export class MailerModule {}
