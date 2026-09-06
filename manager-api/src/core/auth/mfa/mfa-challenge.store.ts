import { Injectable } from "@nestjs/common";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";

// A sign-in whose password was accepted and which came from too far away to be
// taken at face value. Same shape as the second factor's own store, and the
// same promise: what the browser holds in between is an opaque string worth
// nothing to the auth guard, not a token in disguise. Ten minutes rather than
// five, since a code has to travel through a mail server first.
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

export type MfaMethod = "email" | "question";

interface Challenge {
  accountId: string;
  method: MfaMethod;
  // Only for `email`: the code is kept as a keyed hash, so a heap dump of a
  // running process does not hand out the six digits in flight.
  codeHash: string | null;
  expiresAt: number;
  attempts: number;
  /** When a code last went out, null while none ever has: a challenge that
   *  started as a question has sent nothing, so switching it to mail waits for
   *  nobody. */
  mailSentAt: number | null;
}

export interface MfaChallengeView {
  accountId: string;
  method: MfaMethod;
  mailSentAt: number | null;
  /** The deadline it was minted with, which switching proof never moves. */
  expiresAt: number;
}

@Injectable()
export class MfaChallengeStore {
  private readonly challenges = new Map<string, Challenge>();

  private hash(code: string) {
    return createHmac("sha256", "mfa-login-code").update(code).digest("hex");
  }

  mint(accountId: string, method: MfaMethod, code?: string) {
    this.sweep();
    const challenge = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + TTL_MS;
    this.challenges.set(challenge, {
      accountId,
      method,
      codeHash: code ? this.hash(code) : null,
      expiresAt,
      attempts: 0,
      mailSentAt: code ? Date.now() : null,
    });
    return { challenge, expiresAt: new Date(expiresAt) };
  }

  // What a live challenge is about, without spending an attempt: the resend
  // route needs to know whose it is, and answering "who" is not guessing.
  peek(challenge: string): MfaChallengeView | null {
    const entry = this.challenges.get(challenge);
    if (!entry || entry.expiresAt < Date.now()) {
      this.challenges.delete(challenge);
      return null;
    }
    return { accountId: entry.accountId, method: entry.method, mailSentAt: entry.mailSentAt, expiresAt: entry.expiresAt };
  }

  // One try, spent whether the answer is right or wrong: six digits must not be
  // walked through while the challenge lives.
  attempt(challenge: string): MfaChallengeView | null {
    const entry = this.challenges.get(challenge);
    if (!entry || entry.expiresAt < Date.now()) {
      this.challenges.delete(challenge);
      return null;
    }
    entry.attempts += 1;
    if (entry.attempts > MAX_ATTEMPTS) {
      this.challenges.delete(challenge);
      return null;
    }
    return { accountId: entry.accountId, method: entry.method, mailSentAt: entry.mailSentAt, expiresAt: entry.expiresAt };
  }

  // True only for an `email` challenge holding exactly this code.
  matches(challenge: string, code: string): boolean {
    const entry = this.challenges.get(challenge);
    if (!entry?.codeHash) return false;
    const candidate = Buffer.from(this.hash(code));
    const stored = Buffer.from(entry.codeHash);
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }

  // A second code for the same challenge: the first stops working there and
  // then, so a code read over someone's shoulder dies with the resend.
  replaceCode(challenge: string, code: string) {
    const entry = this.challenges.get(challenge);
    if (!entry) return;
    entry.codeHash = this.hash(code);
    entry.mailSentAt = Date.now();
  }

  // The same sign-in, proved another way: whoever cannot read the mailbox right
  // now answers the question instead, and the other way round. The identifier,
  // the deadline and the tries already spent all stay, so switching is a change
  // of proof and never a fresh set of guesses.
  switchTo(challenge: string, method: MfaMethod, code?: string) {
    const entry = this.challenges.get(challenge);
    if (!entry) return;
    entry.method = method;
    entry.codeHash = code ? this.hash(code) : null;
    if (code) entry.mailSentAt = Date.now();
  }

  settle(challenge: string) {
    this.challenges.delete(challenge);
  }

  private sweep() {
    const now = Date.now();
    for (const [challenge, entry] of this.challenges) {
      if (entry.expiresAt < now) this.challenges.delete(challenge);
    }
  }
}
