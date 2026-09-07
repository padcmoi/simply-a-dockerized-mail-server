import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../../entities/account.entity";
import { AccountAddress } from "../../entities/account-address.entity";
import { AccountMfa } from "../../entities/account-mfa.entity";
import { AccountNetwork } from "../../entities/account-network.entity";
import { ActivityLogModule } from "../../activity/activity-log.module";
import { GeoipModule } from "../../geoip/geoip.module";
import { MailerModule } from "../../mailer/mailer.module";
import { SettingsModule } from "../../settings/settings.module";
import { LoginRiskService } from "./login-risk.service";
import { MfaChallengeStore } from "./mfa-challenge.store";
import { MfaController } from "./mfa.controller";
import { MfaLoginService } from "./mfa-login.service";
import { MfaService } from "./mfa.service";

// Imported by the JWT module, which asks it at every sign-in, and by the
// accounts module, which lets an administrator clear a forgotten question. It
// knows accounts by id and by email, and nothing more about them.
@Module({
  imports: [
    TypeOrmModule.forFeature([AccountMfa, AccountNetwork, AccountAddress, Account]),
    ActivityLogModule,
    GeoipModule,
    MailerModule,
    SettingsModule,
  ],
  providers: [MfaService, LoginRiskService, MfaLoginService, MfaChallengeStore],
  controllers: [MfaController],
  exports: [MfaService, LoginRiskService, MfaLoginService, MfaChallengeStore],
})
export class MfaModule {}
