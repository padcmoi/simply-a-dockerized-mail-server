import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TwoFactorChallengeStore } from "../../src/core/auth/two-factor/two-factor-challenge.store";

describe("TwoFactorChallengeStore", () => {
  let store: TwoFactorChallengeStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    store = new TwoFactorChallengeStore();
  });
  afterEach(() => vi.useRealTimers());

  describe("mint", () => {
    it("answers an opaque challenge that expires in five minutes", () => {
      const { challenge, expiresAt } = store.mint("a1");
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(expiresAt.toISOString()).toBe("2026-01-01T00:05:00.000Z");
    });

    it("never hands out the same challenge twice", () => {
      expect(store.mint("a1").challenge).not.toBe(store.mint("a1").challenge);
    });
  });

  describe("attempt", () => {
    it("names the account behind a live challenge", () => {
      const { challenge } = store.mint("a1");
      expect(store.attempt(challenge)).toBe("a1");
    });

    it("answers null for a challenge it never minted", () => {
      expect(store.attempt("nope")).toBeNull();
    });

    it("answers null once the challenge has expired", () => {
      const { challenge } = store.mint("a1");
      vi.advanceTimersByTime(5 * 60_000 + 1);
      expect(store.attempt(challenge)).toBeNull();
    });

    it("allows five attempts and refuses the sixth for good", () => {
      const { challenge } = store.mint("a1");
      for (let i = 0; i < 5; i += 1) expect(store.attempt(challenge)).toBe("a1");
      expect(store.attempt(challenge)).toBeNull();
      expect(store.attempt(challenge)).toBeNull();
    });
  });

  describe("settle", () => {
    it("spends the challenge so it answers no more", () => {
      const { challenge } = store.mint("a1");
      store.settle(challenge);
      expect(store.attempt(challenge)).toBeNull();
    });

    it("is harmless on an unknown challenge", () => {
      expect(() => store.settle("nope")).not.toThrow();
    });
  });

  describe("sweep", () => {
    it("drops expired challenges when a new one is minted, keeps the live ones", () => {
      const old = store.mint("a1");
      vi.advanceTimersByTime(4 * 60_000);
      const fresh = store.mint("a2");
      vi.advanceTimersByTime(90_000);
      store.mint("a3");
      expect(store.attempt(old.challenge)).toBeNull();
      expect(store.attempt(fresh.challenge)).toBe("a2");
    });
  });
});
