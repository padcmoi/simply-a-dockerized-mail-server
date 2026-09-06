import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MfaChallengeStore } from "../../src/core/auth/mfa/mfa-challenge.store";

describe("MfaChallengeStore", () => {
  let store: MfaChallengeStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MfaChallengeStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mints an opaque challenge, not a token: nothing in it names the account", () => {
    const { challenge } = store.mint("a1", "email", "123456");
    expect(challenge).toMatch(/^[\w-]{20,}$/);
    expect(challenge).not.toContain("a1");
  });

  it("gives two sign-ins two different challenges", () => {
    expect(store.mint("a1", "question").challenge).not.toBe(store.mint("a1", "question").challenge);
  });

  it("says whose a live challenge is, and what it expects", () => {
    const { challenge } = store.mint("a1", "question");
    expect(store.peek(challenge)).toMatchObject({ accountId: "a1", method: "question" });
  });

  it("knows nothing of a challenge it never minted", () => {
    expect(store.peek("made-up")).toBeNull();
    expect(store.attempt("made-up")).toBeNull();
  });

  it("forgets a challenge ten minutes after it was minted", () => {
    const { challenge, expiresAt } = store.mint("a1", "email", "123456");
    expect(expiresAt.getTime() - Date.now()).toBe(10 * 60_000);
    vi.advanceTimersByTime(10 * 60_000 + 1);
    expect(store.peek(challenge)).toBeNull();
  });

  it("accepts the code it was minted with, and refuses every other", () => {
    const { challenge } = store.mint("a1", "email", "123456");
    expect(store.matches(challenge, "654321")).toBe(false);
    expect(store.matches(challenge, "123456")).toBe(true);
  });

  it("matches nothing on a challenge that carries no code", () => {
    const { challenge } = store.mint("a1", "question");
    expect(store.matches(challenge, "123456")).toBe(false);
  });

  it("gives up after five tries, so six digits cannot be walked through", () => {
    const { challenge } = store.mint("a1", "email", "123456");
    for (let i = 0; i < 5; i += 1) expect(store.attempt(challenge)).not.toBeNull();
    expect(store.attempt(challenge)).toBeNull();
    expect(store.peek(challenge)).toBeNull();
  });

  it("kills the previous code when a new one is sent", () => {
    const { challenge } = store.mint("a1", "email", "111111");
    store.replaceCode(challenge, "222222");
    expect(store.matches(challenge, "111111")).toBe(false);
    expect(store.matches(challenge, "222222")).toBe(true);
  });

  it("does nothing when asked to replace the code of a challenge that is gone", () => {
    expect(() => store.replaceCode("made-up", "222222")).not.toThrow();
  });

  it("marks the moment of each send, which is what paces a resend", () => {
    const { challenge } = store.mint("a1", "email", "111111");
    const first = store.peek(challenge)?.mailSentAt ?? 0;
    vi.advanceTimersByTime(45_000);
    store.replaceCode(challenge, "222222");
    expect((store.peek(challenge)?.mailSentAt ?? 0) - first).toBe(45_000);
  });

  // A challenge that started as a question has sent nothing, so a switch to the
  // code waits for no interval.
  it("has no send to pace on a challenge that never sent one", () => {
    const { challenge } = store.mint("a1", "question");
    expect(store.peek(challenge)?.mailSentAt).toBeNull();
  });

  describe("switching the proof", () => {
    it("turns a question challenge into a code one, on the same identifier", () => {
      const { challenge } = store.mint("a1", "question");
      store.switchTo(challenge, "email", "123456");
      expect(store.peek(challenge)?.method).toBe("email");
      expect(store.matches(challenge, "123456")).toBe(true);
    });

    it("turns a code challenge into a question one, and the old code stops working", () => {
      const { challenge } = store.mint("a1", "email", "111111");
      store.switchTo(challenge, "question");
      expect(store.peek(challenge)?.method).toBe("question");
      expect(store.matches(challenge, "111111")).toBe(false);
    });

    // Otherwise switching back and forth would buy an endless supply of tries.
    it("keeps the tries already spent", () => {
      const { challenge } = store.mint("a1", "email", "111111");
      store.attempt(challenge);
      store.attempt(challenge);
      store.switchTo(challenge, "question");
      store.attempt(challenge);
      store.attempt(challenge);
      store.attempt(challenge);
      expect(store.attempt(challenge)).toBeNull();
    });

    it("keeps the deadline it was minted with", () => {
      const { challenge, expiresAt } = store.mint("a1", "question");
      vi.advanceTimersByTime(60_000);
      store.switchTo(challenge, "email", "123456");
      expect(store.peek(challenge)?.expiresAt).toBe(expiresAt.getTime());
    });

    it("does nothing when the challenge is gone", () => {
      expect(() => store.switchTo("made-up", "email", "123456")).not.toThrow();
    });
  });

  it("is spent once it is settled", () => {
    const { challenge } = store.mint("a1", "question");
    store.settle(challenge);
    expect(store.peek(challenge)).toBeNull();
  });

  it("sweeps what has expired when a new challenge is minted", () => {
    const stale = store.mint("a1", "question").challenge;
    vi.advanceTimersByTime(11 * 60_000);
    store.mint("a2", "question");
    expect(store.peek(stale)).toBeNull();
  });
});
