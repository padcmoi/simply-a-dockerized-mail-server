import { Module } from "@nestjs/common";
import { JwtAuthModule } from "../../../core/auth/jwt/jwt.module";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { AccountsSessionsController } from "./sessions.controller";

@Module({
  imports: [JwtAuthModule, CustomPermissionGuardModule],
  controllers: [AccountsSessionsController],
})
export class AccountsSessionsModule {}
