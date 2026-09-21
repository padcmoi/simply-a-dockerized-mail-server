import { Module } from "@nestjs/common";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { NotificationsModule as CoreNotificationsModule } from "../../core/notifications/notifications.module";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [CoreNotificationsModule, CustomPermissionGuardModule],
  controllers: [NotificationsController],
})
export class NotificationsApiModule {}
