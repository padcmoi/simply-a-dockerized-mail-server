import { Module } from "@nestjs/common";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { Fail2banController } from "./fail2ban.controller";
import { ActivityLogModule } from "../../core/activity/activity-log.module";
import { Fail2banCoreModule } from "../../core/fail2ban/fail2ban.module";

@Module({
  imports: [CustomPermissionGuardModule, Fail2banCoreModule, ActivityLogModule],
  controllers: [Fail2banController],
})
export class Fail2banApiModule {}
