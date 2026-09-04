import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../../entities/account.entity";
import { AccountProfile } from "../../entities/account-profile.entity";
import { GroupMember } from "../../entities/group-member.entity";
import { Group } from "../../entities/group.entity";
import { RefreshToken } from "../../entities/refresh-token.entity";
import { VirtualAlias } from "../../entities/virtual-alias.entity";
import { VirtualDomain } from "../../entities/virtual-domain.entity";
import { VirtualQuotaUser } from "../../entities/virtual-quota-user.entity";
import { VirtualUser } from "../../entities/virtual-user.entity";
import { CustomPermissionGuardModule } from "../../custom-permission-guard/custom-permission-guard.module";
import { GeocodingModule } from "../../geocoding/geocoding.module";
import { MailerModule } from "../../mailer/mailer.module";
import { TwoFactorModule } from "../two-factor/two-factor.module";
import { JwtAuthController } from "./jwt.controller";
import { JwtAuthService } from "./jwt.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      Account,
      AccountProfile,
      Group,
      GroupMember,
      RefreshToken,
      VirtualAlias,
      VirtualDomain,
      VirtualQuotaUser,
      VirtualUser,
    ]),
    CustomPermissionGuardModule,
    GeocodingModule,
    MailerModule,
    TwoFactorModule,
  ],
  providers: [JwtAuthService, JwtStrategy],
  controllers: [JwtAuthController],
  exports: [JwtAuthService, JwtModule],
})
export class JwtAuthModule {}
