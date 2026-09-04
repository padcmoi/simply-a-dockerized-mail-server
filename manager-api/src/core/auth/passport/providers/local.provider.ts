import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { Strategy } from "passport-local";
import { Repository } from "typeorm";
import { scryptVerify } from "../../../common/scrypt";
import { Account } from "../../../entities/account.entity";
import { ActivityLogService } from "../../../activity/activity-log.service";

// Email and password, as a provider like every other way in. It lives beside
// the external ones on purpose: local is not a separate mechanism, it is the
// provider that verifies a credential this server holds itself instead of one
// someone else vouches for. What it answers is an Account, and the session
// opened for it afterwards is the very same one an external provider gets.
//
// The whole local credential check lives here and nowhere else: the account is
// looked up, its stored hash is verified, and every refusal is the same flat
// answer. An account with no password at all (created by an external sign-in,
// or not yet through an invitation) can never be reached this way.
@Injectable()
export class LocalProvider extends PassportStrategy(Strategy, "local") {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly activity: ActivityLogService
  ) {
    // Passport's own field names are `username`/`password`; the login identity
    // here is the email, so the incoming field is renamed rather than the API
    // contract being bent to Passport's vocabulary.
    super({ usernameField: "email", passwordField: "password" });
  }

  async validate(email: string, password: string): Promise<Account> {
    const account = await this.accounts.findOne({ where: { email, enabled: 1 } });
    // Deliberately flat: a missing account, a disabled one, an account with no
    // password and a wrong password are one answer, so the form can never be
    // used to find out which addresses exist here.
    if (!account || !account.password || !(await scryptVerify(password, account.password))) {
      await this.activity.record({ action: "auth.login.refused", actorId: account?.id ?? null, details: { email } });
      throw new UnauthorizedException("Invalid credentials");
    }
    return account;
  }
}
