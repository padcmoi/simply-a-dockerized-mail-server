import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";

// A provider's callback cannot hand the browser a token pair: it arrives as a
// redirect, and tokens in a redirect URL land in the history, the referrer and
// every proxy log on the way. It hands over this code instead, which is worth
// one POST from the interface and nothing after: single use, thirty seconds,
// and it carries an account id rather than a session.
const TTL_MS = 30_000;

@Injectable()
export class PassportExchangeStore {
  private readonly codes = new Map<string, { accountId: string; expiresAt: number }>();

  mint(accountId: string) {
    this.sweep();
    const code = randomBytes(32).toString("base64url");
    this.codes.set(code, { accountId, expiresAt: Date.now() + TTL_MS });
    return code;
  }

  // Deleted whether or not it was still valid: a code presented twice is spent
  // twice, and the second caller gets nothing.
  claim(code: string) {
    const entry = this.codes.get(code);
    this.codes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.accountId;
  }

  private sweep() {
    const now = Date.now();
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt < now) this.codes.delete(code);
    }
  }
}
