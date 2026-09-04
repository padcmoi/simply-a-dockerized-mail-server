import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../custom-permission-guard/custom-permission-guard.module";
import { AccountIdentity } from "../../entities/account-identity.entity";
import { PassportProviderCredential } from "../../entities/passport-provider-credential.entity";
import { AccountProfile } from "../../entities/account-profile.entity";
import { Account } from "../../entities/account.entity";
import { Group } from "../../entities/group.entity";
import { SettingsModule } from "../../settings/settings.module";
import { JwtAuthModule } from "../jwt/jwt.module";
import { PassportExchangeStore } from "./passport-exchange.store";
import { PassportAuthController } from "./passport.controller";
import { PassportProviderGuard } from "./passport.guard";
import { PassportAuthService } from "./passport.service";
import { ProviderRegistryService } from "./provider-registry.service";
import { LocalProvider } from "./providers/local.provider";
import { ActivityLogModule } from "../../activity/activity-log.module";

// Every way into this manager is a Passport strategy, and they all live here:
// `local` verifies a password this server holds, the others verify an identity
// a provider vouches for. Whichever answers, JwtAuthService opens the same
// session, so nothing downstream knows which door was used.
//
// External providers are not DI providers: ProviderRegistryService builds their
// strategies from the credentials it reads in the database and hands them to
// passport.use() itself, which is what lets an admin configure one from the
// interface and have it work on the next sign-in. Only `local` is registered
// here, because it needs no credentials.
//
// Adding a provider is a file in ./providers plus a line in the catalog.
@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([Account, AccountIdentity, AccountProfile, Group, PassportProviderCredential]),
    CustomPermissionGuardModule,
    SettingsModule,
    // For JwtAuthService.openSessionFor: whichever provider proved the
    // identity, the session opened for it is the same one.
    JwtAuthModule,
    ActivityLogModule,
  ],
  providers: [PassportAuthService, PassportExchangeStore, PassportProviderGuard, ProviderRegistryService, LocalProvider],
  controllers: [PassportAuthController],
  // For the root-only /config/passport controller: it reads the provider
  // catalog through the same service the login screen does, and writes
  // credentials through the registry.
  exports: [PassportAuthService, ProviderRegistryService],
})
export class PassportAuthModule {}
