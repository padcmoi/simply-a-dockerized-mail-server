import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";

// A sign-in whose password (or provider) has been accepted and whose second
// factor has not: the account is known, no session exists. What the browser
// holds in between is this challenge, and it is NOT a token in disguise: it is
// an opaque random string kept here, worth nothing to the auth guard, so a
// challenge stolen off the wire opens no door on its own. Five minutes, a
// handful of attempts, gone the moment a code is accepted.
const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

interface Challenge {
  accountId: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class TwoFactorChallengeStore {
  private readonly challenges = new Map<string, Challenge>();

  mint(accountId: string) {
    this.sweep();
    const challenge = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + TTL_MS;
    this.challenges.set(challenge, { accountId, expiresAt, attempts: 0 });
    return { challenge, expiresAt: new Date(expiresAt) };
  }

  // The account behind a live challenge, or null. Each look-up is an attempt:
  // the sixth is refused whatever the code, so the six digits cannot be walked
  // through while the challenge lives.
  attempt(challenge: string) {
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
    return entry.accountId;
  }

  // Spent whether it was accepted or not: a challenge answers once.
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
