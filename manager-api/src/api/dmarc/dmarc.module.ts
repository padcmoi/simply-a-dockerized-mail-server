import { Module } from "@nestjs/common";
import { ActivityLogModule } from "../../core/activity/activity-log.module";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { DmarcCoreModule } from "../../core/dmarc/dmarc.module";
import { DmarcController } from "./dmarc.controller";

@Module({ imports: [CustomPermissionGuardModule, DmarcCoreModule, ActivityLogModule], controllers: [DmarcController] })
export class DmarcApiModule {}
