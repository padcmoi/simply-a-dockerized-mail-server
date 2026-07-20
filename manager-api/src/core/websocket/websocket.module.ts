import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtAuthModule } from "../auth/jwt/jwt.module";
import { CustomPermissionGuardModule } from "../custom-permission-guard/custom-permission-guard.module";
import { RefreshToken } from "../entities/refresh-token.entity";
import { WebsocketGateway } from "./websocket.gateway";
import { WebsocketService } from "./websocket.service";

@Module({
  imports: [JwtAuthModule, CustomPermissionGuardModule, TypeOrmModule.forFeature([RefreshToken])],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
