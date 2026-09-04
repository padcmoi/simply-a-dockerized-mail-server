import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountTwoFactor } from "../../entities/account-two-factor.entity";
import { TwoFactorChallengeStore } from "./two-factor-challenge.store";
import { TwoFactorController } from "./two-factor.controller";
import { TwoFactorService } from "./two-factor.service";

// Imported by the JWT module, which asks it at every sign-in, and by the
// accounts module, which lets an administrator reset a locked-out account. It
// depends on neither: the second factor knows accounts by id and nothing more.
@Module({
  imports: [TypeOrmModule.forFeature([AccountTwoFactor])],
  providers: [TwoFactorService, TwoFactorChallengeStore],
  controllers: [TwoFactorController],
  exports: [TwoFactorService, TwoFactorChallengeStore],
})
export class TwoFactorModule {}
