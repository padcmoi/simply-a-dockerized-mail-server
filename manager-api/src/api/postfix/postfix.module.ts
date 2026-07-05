import { Module } from "@nestjs/common";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { PostfixCoreModule } from "../../core/postfix/postfix.module";
import { PostfixController } from "./postfix.controller";

@Module({ imports: [PostfixCoreModule, CustomPermissionGuardModule], controllers: [PostfixController] })
export class PostfixModule {}
