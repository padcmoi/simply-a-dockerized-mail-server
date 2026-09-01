import { Module } from "@nestjs/common";
import { PassportAuthModule } from "../../core/auth/passport/passport.module";
import { MailerModule } from "../../core/mailer/mailer.module";
import { SettingsModule } from "../../core/settings/settings.module";
import { MailConfigController } from "./mail-config.controller";
import { MailCadenceController } from "./mail-cadence.controller";
import { GeneralController } from "./general.controller";
import { PassportConfigController } from "./passport-config.controller";
import { SupervisionRetentionController } from "./supervision-retention.controller";
import { TicketsConfigController } from "./tickets-config.controller";

@Module({
  imports: [MailerModule, SettingsModule, PassportAuthModule],
  controllers: [
    MailConfigController,
    MailCadenceController,
    GeneralController,
    SupervisionRetentionController,
    TicketsConfigController,
    PassportConfigController,
  ],
})
export class ConfigApiModule {}
