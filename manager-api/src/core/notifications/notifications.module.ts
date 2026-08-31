import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../entities/account.entity";
import { AccountProfile } from "../entities/account-profile.entity";
import { Notification } from "../entities/notification.entity";
import { NotificationPreference } from "../entities/notification-preference.entity";
import { MailerModule } from "../mailer/mailer.module";
import { NotificationsService } from "./notifications.service";
import { OfflineNotificationsService } from "./offline-notifications.service";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference, Account, AccountProfile]),
    MailerModule,
    SettingsModule,
  ],
  providers: [NotificationsService, OfflineNotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
