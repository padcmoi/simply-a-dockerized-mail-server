import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../custom-permission-guard/custom-permission-guard.module";
import { ApiTokenController } from "./api-token.controller";
import { ApiToken } from "./api-token.entity";
import { ApiTokenService } from "./api-token.service";
import { ApiTokenAccess } from "./api-token-access.entity";
import { ApiTokenAccessMiddleware } from "./api-token-access.middleware";
import { ApiTokenAccessService } from "./api-token-access.service";

@Module({
  imports: [TypeOrmModule.forFeature([ApiToken, ApiTokenAccess]), CustomPermissionGuardModule],
  providers: [ApiTokenService, ApiTokenAccessService, ApiTokenAccessMiddleware],
  controllers: [ApiTokenController],
  exports: [ApiTokenService, ApiTokenAccessService],
})
export class ApiTokenModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiTokenAccessMiddleware).forRoutes("*");
  }
}
