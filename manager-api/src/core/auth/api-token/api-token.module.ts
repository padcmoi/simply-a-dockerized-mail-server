import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../custom-permission-guard/custom-permission-guard.module";
import { ApiTokenController } from "./api-token.controller";
import { ApiToken } from "./api-token.entity";
import { ApiTokenService } from "./api-token.service";

@Module({
  imports: [TypeOrmModule.forFeature([ApiToken]), CustomPermissionGuardModule],
  providers: [ApiTokenService],
  controllers: [ApiTokenController],
  exports: [ApiTokenService],
})
export class ApiTokenModule {}
