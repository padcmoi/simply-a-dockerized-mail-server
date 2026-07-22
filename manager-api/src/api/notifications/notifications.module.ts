import { Module } from "@nestjs/common";
import { NotificationsModule as CoreNotificationsModule } from "../../core/notifications/notifications.module";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [CoreNotificationsModule],
  controllers: [NotificationsController],
})
export class NotificationsApiModule {}
