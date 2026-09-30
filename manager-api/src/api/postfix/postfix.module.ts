import { Module } from "@nestjs/common";
import { ActivityLogModule } from "../../core/activity/activity-log.module";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { PostfixCoreModule } from "../../core/postfix/postfix.module";
import { PostfixController } from "./postfix.controller";

@Module({ imports: [PostfixCoreModule, CustomPermissionGuardModule, ActivityLogModule], controllers: [PostfixController] })
export class PostfixModule {}
