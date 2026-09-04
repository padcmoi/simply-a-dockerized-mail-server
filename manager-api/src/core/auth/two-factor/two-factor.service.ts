import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiError } from "../../common/api-error";
import { AccountTwoFactor } from "../../entities/account-two-factor.entity";
import { decryptSecret, encryptSecret } from "../api-token/api-token.cipher";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, matchRecoveryCode, matchTotp, otpauthUri } from "./totp";

// Consecutive refusals an account gets before its codes stop being checked for
// a while. The login challenge has its own five attempts; this one covers the
// authenticated routes, where a stolen session could otherwise walk the six
// digits to switch the factor off.
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60_000;

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
}

@Injectable()
export class TwoFactorService {
  private readonly failures = new Map<string, { count: number; until: number }>();

  constructor(@InjectRepository(AccountTwoFactor) private readonly rows: Repository<AccountTwoFactor>) {}

  private pepper() {
    const p = process.env.MANAGER_API_TOKEN_PEPPER;
    if (!p) throw new Error("MANAGER_API_TOKEN_PEPPER env var is required");
    return p;
  }

  private secretOf(row: AccountTwoFactor) {
    const secret = decryptSecret(row.secretCipher, this.pepper());
    if (!secret) throw new Error(`Two-factor secret of account ${row.accountId} cannot be opened with this pepper`);
    return secret;
  }

  async status(accountId: string): Promise<TwoFactorStatus> {
    const row = await this.rows.findOne({ where: { accountId } });
    const enabled = !!row?.enabledAt;
    return {
      enabled,
      enabledAt: row?.enabledAt?.toISOString() ?? null,
      recoveryCodesLeft: enabled ? row!.recoveryCodes.length : 0,
    };
  }

  async isEnabled(accountId: string) {
    const row = await this.rows.findOne({ where: { accountId } });
    return !!row?.enabledAt;
  }

  // A fresh secret, shown to be scanned, proved by nothing yet: the account
  // keeps signing in with one factor until `enable` sees a code from it. Asking
  // again replaces the pending secret, so an abandoned setup never lingers as
  // something a later scan could match. An enabled factor is not replaced this
  // way: it is switched off first, with a code.
  async beginSetup(accountId: string, email: string) {
    const existing = await this.rows.findOne({ where: { accountId } });
    if (existing?.enabledAt) {
      throw new ApiError(HttpStatus.CONFLICT, "twoFactor.alreadyEnabled", "Two-factor authentication is already enabled");
    }
    const secret = generateTotpSecret();
    await this.rows.save(
      this.rows.create({
        accountId,
        secretCipher: encryptSecret(secret, this.pepper()),
        enabledAt: null,
        lastUsedStep: null,
        recoveryCodes: [],
      })
    );
    return { secret, otpauthUri: otpauthUri(email, secret) };
  }

  // The code proves the app holds the secret that was shown; only then does
  // the factor count. The recovery codes are minted here and returned once:
  // this is the one answer that ever carries them in clear.
  async enable(accountId: string, code: string) {
    const row = await this.rows.findOne({ where: { accountId } });
    if (!row) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "twoFactor.noSetupPending", "No two-factor setup is pending");
    }
    if (row.enabledAt) {
      throw new ApiError(HttpStatus.CONFLICT, "twoFactor.alreadyEnabled", "Two-factor authentication is already enabled");
    }
    this.assertNotLocked(accountId);
    const step = matchTotp(this.secretOf(row), code, null);
    if (step === null) this.refuse(accountId);
    this.failures.delete(accountId);
    const recoveryCodes = generateRecoveryCodes();
    row.enabledAt = new Date();
    row.lastUsedStep = String(step);
    row.recoveryCodes = recoveryCodes.map((code) => hashRecoveryCode(code, this.pepper()));
    await this.rows.save(row);
    return { recoveryCodes };
  }

  // Switching the factor off takes a code from the app, or a recovery code:
  // the phone being gone is exactly when this is needed most.
  async disable(accountId: string, code: string) {
    const row = await this.enabledRow(accountId);
    this.assertNotLocked(accountId);
    if (!(await this.consume(row, code))) this.refuse(accountId);
    this.failures.delete(accountId);
    await this.rows.delete({ accountId });
    return { disabled: true };
  }

  // A new set replaces whatever was left, whether one was used or all of them
  // were lost with the sheet they were written on. A code from the app, not a
  // recovery code: the sheet must not be able to print itself a new sheet.
  async regenerateRecoveryCodes(accountId: string, code: string) {
    const row = await this.enabledRow(accountId);
    this.assertNotLocked(accountId);
    if (!(await this.consumeTotp(row, code))) this.refuse(accountId);
    this.failures.delete(accountId);
    const recoveryCodes = generateRecoveryCodes();
    row.recoveryCodes = recoveryCodes.map((code) => hashRecoveryCode(code, this.pepper()));
    await this.rows.save(row);
    return { recoveryCodes };
  }

  // The sign-in's second step. Either kind of code is accepted, and either is
  // spent by it: the app's code by its step, a recovery code for good.
  async verifyForLogin(accountId: string, code: string) {
    const row = await this.rows.findOne({ where: { accountId } });
    if (!row?.enabledAt) return false;
    return this.consume(row, code);
  }

  // An administrator's way out for an account whose phone and sheet are both
  // gone: the factor is removed without a code, and the account signs in with
  // its password again. Nothing else is touched.
  async reset(accountId: string) {
    const result = await this.rows.delete({ accountId });
    return { reset: (result.affected ?? 0) > 0 };
  }

  private async enabledRow(accountId: string) {
    const row = await this.rows.findOne({ where: { accountId } });
    if (!row?.enabledAt) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "twoFactor.notEnabled", "Two-factor authentication is not enabled");
    }
    return row;
  }

  private async consume(row: AccountTwoFactor, code: string) {
    if (await this.consumeTotp(row, code)) return true;
    const index = matchRecoveryCode(code, row.recoveryCodes, this.pepper());
    if (index < 0) return false;
    row.recoveryCodes = row.recoveryCodes.filter((_, i) => i !== index);
    await this.rows.save(row);
    return true;
  }

  private async consumeTotp(row: AccountTwoFactor, code: string) {
    const lastUsed = row.lastUsedStep === null ? null : Number(row.lastUsedStep);
    const step = matchTotp(this.secretOf(row), code, lastUsed);
    if (step === null) return false;
    row.lastUsedStep = String(step);
    await this.rows.save(row);
    return true;
  }

  private assertNotLocked(accountId: string) {
    const entry = this.failures.get(accountId);
    if (entry && entry.count >= MAX_FAILURES && entry.until > Date.now()) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        "twoFactor.tooManyAttempts",
        "Too many wrong codes, try again in a few minutes"
      );
    }
    if (entry && entry.until <= Date.now()) this.failures.delete(accountId);
  }

  private refuse(accountId: string): never {
    const entry = this.failures.get(accountId) ?? { count: 0, until: 0 };
    entry.count += 1;
    entry.until = Date.now() + LOCKOUT_MS;
    this.failures.set(accountId, entry);
    throw new ApiError(HttpStatus.BAD_REQUEST, "twoFactor.invalidCode", "This code is not valid");
  }
}
