import { Module } from "@nestjs/common";
import { MailerModule } from "../../core/mailer/mailer.module";
import { SettingsModule } from "../../core/settings/settings.module";
import { MailConfigController } from "./mail-config.controller";
import { MailCadenceController } from "./mail-cadence.controller";
import { GeneralController } from "./general.controller";

@Module({
  imports: [MailerModule, SettingsModule],
  controllers: [MailConfigController, MailCadenceController, GeneralController],
})
export class ConfigApiModule {}
