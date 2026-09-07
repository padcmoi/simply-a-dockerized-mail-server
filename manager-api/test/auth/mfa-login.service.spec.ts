import { describe, it, expect, beforeEach, vi } from "vitest";
import { MfaLoginService } from "../../src/core/auth/mfa/mfa-login.service";
import { MfaChallengeStore } from "../../src/core/auth/mfa/mfa-challenge.store";
import { APP_SETTINGS_DEFAULTS, type AppSettingsService } from "../../src/core/settings/app-settings.service";
import type { ActivityLogService } from "../../src/core/activity/activity-log.service";
import type { MailerService } from "../../src/core/mailer/mailer.service";
import type { MfaService } from "../../src/core/auth/mfa/mfa.service";
import type { FarAway } from "../../src/core/auth/mfa/login-risk.service";
import type { Account } from "../../src/core/entities/account.entity";
import { entity, providerMock, repoMock } from "../helpers/mocks";

const ACCOUNT = entity<Account>({ id: "a1", email: "julien@example.com" });
const FAR: FarAway = {
  distanceKm: 680,
  thresholdKm: 100,
  countryCode: "FR",
  asn: 3215,
  asnOrg: "Orange",
  city: "Paris",
  reasons: ["distance"],
};

function makeMocks() {
  const accounts = repoMock<Account>();
  accounts.findOne.mockResolvedValue(ACCOUNT);
  return {
    accounts,
    mfa: providerMock<MfaService>({ questionOf: vi.fn(async () => null), verifyAnswer: vi.fn(async () => true) }),
    challenges: new MfaChallengeStore(),
    mailer: providerMock<MailerService>({ isEnabled: vi.fn(async () => true), sendLoginCode: vi.fn(async () => undefined) }),
    activity: providerMock<ActivityLogService>({ record: vi.fn(async () => undefined) }),
    settings: providerMock<AppSettingsService>({ get: vi.fn(() => APP_SETTINGS_DEFAULTS) }),
  };
}

describe("MfaLoginService.open", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaLoginService;

  beforeEach(() => {
    m = makeMocks();
    svc = new MfaLoginService(m.accounts, m.mfa, m.challenges, m.mailer, m.activity, m.settings);
  });

  const preferring = (loginChallengeOrder: "email,question" | "question,email") =>
    m.settings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, loginChallengeOrder });

  it("records the distance, the operator, the reasons and what it ended up asking for", async () => {
    await svc.open(ACCOUNT, FAR);
    expect(m.activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login.far",
        details: expect.objectContaining({
          distanceKm: 680,
          thresholdKm: 100,
          asn: 3215,
          reasons: ["distance"],
          method: "email",
        }),
      })
    );
  });

  it("records that nothing could be asked, which is the case worth seeing in the journal", async () => {
    m.mailer.isEnabled.mockResolvedValue(false);
    m.mfa.questionOf.mockResolvedValue(null);
    await svc.open(ACCOUNT, FAR);
    expect(m.activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ method: "none" }) })
    );
  });

  // The order is a preference between the two, not an exclusion: what cannot be
  // offered is skipped rather than refused.
  it("asks the question first when that is the order it was given", async () => {
    preferring("question,email");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    expect(await svc.open(ACCOUNT, FAR)).toMatchObject({ method: "question" });
    expect(m.mailer.sendLoginCode).not.toHaveBeenCalled();
  });

  it("falls through to the mail when the preferred question has never been chosen", async () => {
    preferring("question,email");
    m.mfa.questionOf.mockResolvedValue(null);
    expect(await svc.open(ACCOUNT, FAR)).toMatchObject({ method: "email" });
  });

  it("records the question as the method when the question is what it asked", async () => {
    preferring("question,email");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    await svc.open(ACCOUNT, FAR);
    expect(m.activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ method: "question" }) })
    );
  });

  it("never records twice for one sign-in, whatever the order", async () => {
    preferring("question,email");
    m.mfa.questionOf.mockResolvedValue(null);
    await svc.open(ACCOUNT, FAR);
    expect(m.activity.record).toHaveBeenCalledTimes(1);
  });

  it("sends a six-digit code by mail when this server can send one", async () => {
    const asked = await svc.open(ACCOUNT, FAR);
    expect(asked).toMatchObject({ mfaRequired: true, method: "email", hint: "j***@example.com" });
    expect(m.mailer.sendLoginCode).toHaveBeenCalledWith(
      expect.objectContaining({ to: "julien@example.com", code: expect.stringMatching(/^\d{6}$/), distanceKm: 680 })
    );
  });

  it("names the operator to the mail when that is what played, and the absence when the memory expired", async () => {
    await svc.open(ACCOUNT, { ...FAR, reasons: ["network"] });
    expect(m.mailer.sendLoginCode).toHaveBeenLastCalledWith(
      expect.objectContaining({ network: "Orange, FR", distanceKm: undefined, absence: false })
    );
    await svc.open(ACCOUNT, { ...FAR, distanceKm: null, reasons: ["expired"] });
    expect(m.mailer.sendLoginCode).toHaveBeenLastCalledWith(expect.objectContaining({ absence: true, network: undefined }));
  });

  it("never puts the code in its own answer", async () => {
    const asked = await svc.open(ACCOUNT, FAR);
    const sentCode = m.mailer.sendLoginCode.mock.calls[0]![0].code as string;
    expect(sentCode).toMatch(/^\d{6}$/);
    expect(JSON.stringify(asked)).not.toContain(sentCode);
  });

  it("falls back to the security question when the mail server refuses the send", async () => {
    m.mailer.sendLoginCode.mockRejectedValue(new Error("connection refused"));
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    const asked = await svc.open(ACCOUNT, FAR);
    expect(asked).toMatchObject({ method: "question", question: "Your father's first name?" });
  });

  it("asks the question straight away on a server that cannot send mail", async () => {
    m.mailer.isEnabled.mockResolvedValue(false);
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    expect(await svc.open(ACCOUNT, FAR)).toMatchObject({ method: "question" });
    expect(m.mailer.sendLoginCode).not.toHaveBeenCalled();
  });

  // Refusing here would lock the owner of a server with no mail and no question
  // out of their own manager, over a move they made themselves.
  it("asks nothing at all when there is neither mail nor question, and says so", async () => {
    m.mailer.isEnabled.mockResolvedValue(false);
    m.mfa.questionOf.mockResolvedValue(null);
    expect(await svc.open(ACCOUNT, FAR)).toBeNull();
  });
});

describe("MfaLoginService.open, the other way it offers", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaLoginService;

  beforeEach(() => {
    m = makeMocks();
    svc = new MfaLoginService(m.accounts, m.mfa, m.challenges, m.mailer, m.activity, m.settings);
  });

  it("offers the question beside a code, when the account has one", async () => {
    m.settings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, loginChallengeOrder: "email,question" });
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    expect(await svc.open(ACCOUNT, FAR)).toMatchObject({ method: "email", alternative: "question" });
  });

  it("offers nothing beside a code when the account has no question", async () => {
    m.settings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, loginChallengeOrder: "email,question" });
    expect((await svc.open(ACCOUNT, FAR))?.alternative).toBeUndefined();
  });

  // Only if it is configured: a button that leads to a 409 is worse than none.
  it("offers the code beside the question only on a server that can send mail", async () => {
    m.settings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, loginChallengeOrder: "question,email" });
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    expect(await svc.open(ACCOUNT, FAR)).toMatchObject({ method: "question", alternative: "email" });

    m.mailer.isEnabled.mockResolvedValue(false);
    expect((await svc.open(ACCOUNT, FAR))?.alternative).toBeUndefined();
  });
});

describe("MfaLoginService, one proof only", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaLoginService;

  beforeEach(() => {
    m = makeMocks();
    svc = new MfaLoginService(m.accounts, m.mfa, m.challenges, m.mailer, m.activity, m.settings);
  });

  const only = (loginChallengeOrder: "email,question" | "question,email") =>
    m.settings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, loginChallengeOrder, loginChallengeExclusive: true });

  it("asks the question alone, never the mail, when the question comes first", async () => {
    only("question,email");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    const asked = await svc.open(ACCOUNT, FAR);
    expect(asked).toMatchObject({ method: "question" });
    expect(asked?.alternative).toBeUndefined();
    expect(m.mailer.sendLoginCode).not.toHaveBeenCalled();
  });

  it("asks nothing rather than the mail when the question was never chosen", async () => {
    only("question,email");
    expect(await svc.open(ACCOUNT, FAR)).toBeNull();
    expect(m.mailer.sendLoginCode).not.toHaveBeenCalled();
    expect(m.activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ method: "none" }) })
    );
  });

  it("sends the code alone and offers no question beside it", async () => {
    only("email,question");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    const asked = await svc.open(ACCOUNT, FAR);
    expect(asked).toMatchObject({ method: "email" });
    expect(asked?.alternative).toBeUndefined();
  });

  it("refuses to switch a live challenge to the other proof", async () => {
    only("email,question");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    const code = m.challenges.mint("a1", "email", "111111");
    await expect(svc.switchTo(code.challenge, "question")).rejects.toMatchObject({ status: 409 });

    only("question,email");
    const question = m.challenges.mint("a1", "question");
    await expect(svc.switchTo(question.challenge, "email")).rejects.toMatchObject({ status: 409 });
    expect(m.mailer.sendLoginCode).not.toHaveBeenCalled();
  });
});

describe("MfaLoginService.switchTo", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaLoginService;

  beforeEach(() => {
    m = makeMocks();
    svc = new MfaLoginService(m.accounts, m.mfa, m.challenges, m.mailer, m.activity, m.settings);
  });

  it("sends a code for a challenge that started as a question, without waiting", async () => {
    const { challenge } = m.challenges.mint("a1", "question");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    const asked = await svc.switchTo(challenge, "email");
    expect(asked).toMatchObject({ method: "email", challenge, hint: "j***@example.com", alternative: "question" });
    expect(m.mailer.sendLoginCode).toHaveBeenCalledWith(
      expect.objectContaining({ to: "julien@example.com", code: expect.stringMatching(/^\d{6}$/) })
    );
  });

  it("never puts the code it just sent in its own answer", async () => {
    const { challenge } = m.challenges.mint("a1", "question");
    const asked = await svc.switchTo(challenge, "email");
    const sentCode = m.mailer.sendLoginCode.mock.calls[0]![0].code as string;
    expect(JSON.stringify(asked)).not.toContain(sentCode);
  });

  it("hands back the question for a challenge that started as a code", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "111111");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    expect(await svc.switchTo(challenge, "question")).toMatchObject({
      method: "question",
      question: "Your father's first name?",
      alternative: "email",
    });
  });

  it("kills the code it switched away from", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "111111");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    await svc.switchTo(challenge, "question");
    expect(m.challenges.matches(challenge, "111111")).toBe(false);
  });

  it("keeps the deadline the challenge was minted with", async () => {
    const { challenge, expiresAt } = m.challenges.mint("a1", "question");
    const asked = await svc.switchTo(challenge, "email");
    expect(asked.expiresAt).toBe(expiresAt.toISOString());
  });

  it("refuses the mail on a server that cannot send any", async () => {
    m.mailer.isEnabled.mockResolvedValue(false);
    const { challenge } = m.challenges.mint("a1", "question");
    await expect(svc.switchTo(challenge, "email")).rejects.toMatchObject({ status: 409 });
  });

  it("refuses the question for an account that never chose one", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "111111");
    await expect(svc.switchTo(challenge, "question")).rejects.toMatchObject({ status: 409 });
  });

  it("refuses an unknown challenge the way an expired one is refused", async () => {
    await expect(svc.switchTo("made-up", "email")).rejects.toMatchObject({ status: 401 });
  });

  it("refuses when the account behind the challenge is gone", async () => {
    const { challenge } = m.challenges.mint("a1", "question");
    m.accounts.findOne.mockResolvedValue(null);
    await expect(svc.switchTo(challenge, "email")).rejects.toMatchObject({ status: 401 });
  });

  // Switching back to the mail is another send, and it obeys the same interval.
  it("makes a second code wait the interval every other mail obeys", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "111111");
    m.mfa.questionOf.mockResolvedValue("Your father's first name?");
    await svc.switchTo(challenge, "question");
    await expect(svc.switchTo(challenge, "email")).rejects.toMatchObject({ status: 429 });
  });
});

describe("MfaLoginService.noteTwoFactor", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaLoginService;

  beforeEach(() => {
    m = makeMocks();
    svc = new MfaLoginService(m.accounts, m.mfa, m.challenges, m.mailer, m.activity, m.settings);
  });

  // An account with the authenticator app is asked nothing more, so the journal
  // is the only place its owner ever learns it signed in from far away.
  it("records the distance without asking anything or minting a challenge", async () => {
    await svc.noteTwoFactor(ACCOUNT, FAR);
    expect(m.activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login.far",
        actorId: "a1",
        details: expect.objectContaining({ distanceKm: 680, thresholdKm: 100, reasons: ["distance"], method: "two-factor" }),
      })
    );
    expect(m.mailer.sendLoginCode).not.toHaveBeenCalled();
  });
});

describe("MfaLoginService.verify", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaLoginService;

  beforeEach(() => {
    m = makeMocks();
    svc = new MfaLoginService(m.accounts, m.mfa, m.challenges, m.mailer, m.activity, m.settings);
  });

  it("names the account behind a code that is right", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "123456");
    expect(await svc.verify(challenge, "123456")).toBe("a1");
  });

  it("refuses a wrong code, records it, and leaves the challenge alive", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "123456");
    await expect(svc.verify(challenge, "654321")).rejects.toMatchObject({ status: 400 });
    expect(m.activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.mfa.refused" }));
    expect(await svc.verify(challenge, "123456")).toBe("a1");
  });

  it("spends the challenge on the answer that works", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "123456");
    await svc.verify(challenge, "123456");
    await expect(svc.verify(challenge, "123456")).rejects.toMatchObject({ status: 401 });
  });

  it("puts a question challenge to the account's own answer", async () => {
    const { challenge } = m.challenges.mint("a1", "question");
    expect(await svc.verify(challenge, "Joel")).toBe("a1");
    expect(m.mfa.verifyAnswer).toHaveBeenCalledWith("a1", "Joel");
  });

  it("refuses a wrong answer to a question", async () => {
    m.mfa.verifyAnswer.mockResolvedValue(false);
    const { challenge } = m.challenges.mint("a1", "question");
    await expect(svc.verify(challenge, "Michel")).rejects.toMatchObject({ status: 400 });
  });

  it("answers an unknown challenge the same way it answers an expired one", async () => {
    await expect(svc.verify("made-up", "123456")).rejects.toMatchObject({ status: 401 });
  });
});

describe("MfaLoginService.resend", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaLoginService;

  beforeEach(() => {
    vi.useFakeTimers();
    m = makeMocks();
    svc = new MfaLoginService(m.accounts, m.mfa, m.challenges, m.mailer, m.activity, m.settings);
  });

  it("refuses a second code before the interval every other mail obeys", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "111111");
    await expect(svc.resend(challenge)).rejects.toMatchObject({ status: 429 });
    vi.useRealTimers();
  });

  it("sends a fresh code once the interval has passed, and kills the previous one", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "111111");
    vi.advanceTimersByTime(APP_SETTINGS_DEFAULTS.mailMinIntervalMs + 1);
    expect(await svc.resend(challenge)).toEqual({ sent: true, hint: "j***@example.com" });
    expect(m.challenges.matches(challenge, "111111")).toBe(false);
    vi.useRealTimers();
  });

  it("refuses to resend on a question challenge, which has no code to send", async () => {
    const { challenge } = m.challenges.mint("a1", "question");
    await expect(svc.resend(challenge)).rejects.toMatchObject({ status: 401 });
    vi.useRealTimers();
  });

  it("refuses an unknown challenge", async () => {
    await expect(svc.resend("made-up")).rejects.toMatchObject({ status: 401 });
    vi.useRealTimers();
  });

  it("refuses when the account behind the challenge is gone", async () => {
    const { challenge } = m.challenges.mint("a1", "email", "111111");
    vi.advanceTimersByTime(APP_SETTINGS_DEFAULTS.mailMinIntervalMs + 1);
    m.accounts.findOne.mockResolvedValue(null);
    await expect(svc.resend(challenge)).rejects.toMatchObject({ status: 401 });
    vi.useRealTimers();
  });
});
