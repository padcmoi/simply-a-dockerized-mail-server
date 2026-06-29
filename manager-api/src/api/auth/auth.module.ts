import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtStrategy } from "../../core/auth/jwt.strategy";
import { Account } from "../../core/entities/account.entity";
import { RefreshToken } from "../../core/entities/refresh-token.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [PassportModule, JwtModule.register({}), TypeOrmModule.forFeature([Account, RefreshToken])],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
