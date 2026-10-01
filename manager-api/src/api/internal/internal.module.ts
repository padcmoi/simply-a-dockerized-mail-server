import { Module } from "@nestjs/common";
import { LoopbackGuard } from "../../core/auth/loopback.guard";
import { MailerModule } from "../../core/mailer/mailer.module";
import { SettingsModule } from "../../core/settings/settings.module";
import { InternalAlertController } from "./internal-alert.controller";

@Module({
  imports: [MailerModule, SettingsModule],
  controllers: [InternalAlertController],
  providers: [LoopbackGuard],
})
export class InternalApiModule {}
