import { Module } from "@nestjs/common";
import { ActivityLogModule } from "../../core/activity/activity-log.module";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { ActivityController } from "./activity.controller";

@Module({
  imports: [ActivityLogModule, CustomPermissionGuardModule],
  controllers: [ActivityController],
})
export class ActivityApiModule {}
