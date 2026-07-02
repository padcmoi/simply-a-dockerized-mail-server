import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../../entities/account.entity";
import { RefreshToken } from "../../entities/refresh-token.entity";
import { JwtAuthController } from "./jwt.controller";
import { JwtAuthService } from "./jwt.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({}), TypeOrmModule.forFeature([Account, RefreshToken])],
  providers: [JwtAuthService, JwtStrategy],
  controllers: [JwtAuthController],
  exports: [JwtAuthService, JwtModule],
})
export class JwtAuthModule {}
