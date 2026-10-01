import { Module } from "@nestjs/common";
import { ActivityLogModule } from "../../core/activity/activity-log.module";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { ProtectionModule } from "../../core/protection/protection.module";
import { ProtectionController } from "./protection.controller";

@Module({ imports: [ProtectionModule, CustomPermissionGuardModule, ActivityLogModule], controllers: [ProtectionController] })
export class ProtectionApiModule {}
