import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DomainsModule } from "../../api/domains/domains.module";
import { JwtAuthModule } from "../auth/jwt/jwt.module";
import { CustomPermissionGuardModule } from "../custom-permission-guard/custom-permission-guard.module";
import { RefreshToken } from "../entities/refresh-token.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { PostfixCoreModule } from "../postfix/postfix.module";
import { WebsocketGateway } from "./websocket.gateway";
import { WebsocketService } from "./websocket.service";

@Module({
  imports: [
    JwtAuthModule,
    CustomPermissionGuardModule,
    DomainsModule,
    PostfixCoreModule,
    TypeOrmModule.forFeature([RefreshToken, VirtualDomain]),
  ],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
