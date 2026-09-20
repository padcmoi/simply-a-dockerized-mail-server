import { Module } from "@nestjs/common";
import { ActivityLogModule } from "../../core/activity/activity-log.module";
import { ClamavCoreModule } from "../../core/clamav/clamav.module";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { ClamavController } from "./clamav.controller";

@Module({
  imports: [CustomPermissionGuardModule, ClamavCoreModule, ActivityLogModule],
  controllers: [ClamavController],
})
export class ClamavApiModule {}
