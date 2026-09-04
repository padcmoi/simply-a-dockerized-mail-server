import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { TwoFactorService } from "../../src/core/auth/two-factor/two-factor.service";
import { AccountTwoFactor } from "../../src/core/entities/account-two-factor.entity";
import { ApiError } from "../../src/core/common/api-error";
import { decryptSecret, encryptSecret } from "../../src/core/auth/api-token/api-token.cipher";
import { generateTotpSecret, hashRecoveryCode, totpCode, totpStep } from "../../src/core/auth/two-factor/totp";
import type { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { entity, providerMock, repoMock } from "../helpers/mocks";

const PEPPER = "two-factor-test-pepper";
const NOW = new Date("2026-01-01T12:00:00.000Z");

function row(overrides: Partial<AccountTwoFactor> = {}) {
  return entity<AccountTwoFactor>({
    accountId: "a1",
    secretCipher: encryptSecret(SECRET, PEPPER),
    enabledAt: null,
    lastUsedStep: null,
    recoveryCodes: [],
    ...overrides,
  });
}

const SECRET = generateTotpSecret();
const codeNow = () => totpCode(SECRET, totpStep(Date.now()));
const wrongCode = () => String((Number(codeNow()) + 1) % 1_000_000).padStart(6, "0");

async function apiError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    const err = e as ApiError;
    return { status: err.getStatus(), code: (err.getResponse() as { code: string }).code };
  }
  throw new Error("expected the call to throw");
}

describe("TwoFactorService", () => {
  let rows: ReturnType<typeof repoMock<AccountTwoFactor>>;
  let activity: ReturnType<typeof providerMock<ActivityLogService>>;
  let svc: TwoFactorService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.MANAGER_API_TOKEN_PEPPER = PEPPER;
    rows = repoMock<AccountTwoFactor>();
    rows.save.mockImplementation(async (x: object) => x);
    rows.delete.mockResolvedValue({ affected: 1 });
    activity = providerMock<ActivityLogService>({ record: vi.fn(async () => undefined) });
    svc = new TwoFactorService(rows, activity);
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.MANAGER_API_TOKEN_PEPPER;
  });

  describe("status", () => {
    it("is off with no row", async () => {
      rows.findOne.mockResolvedValue(null);
      await expect(svc.status("a1")).resolves.toEqual({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });
    });
    it("is off while a setup is pending, with no recovery codes counted", async () => {
      rows.findOne.mockResolvedValue(row({ recoveryCodes: ["x"] }));
      await expect(svc.status("a1")).resolves.toEqual({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });
    });
    it("is on once enabled, counting the recovery codes left", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW, recoveryCodes: ["h1", "h2", "h3"] }));
      await expect(svc.status("a1")).resolves.toEqual({
        enabled: true,
        enabledAt: NOW.toISOString(),
        recoveryCodesLeft: 3,
      });
    });
  });

  describe("isEnabled", () => {
    it("answers false with no row or a pending setup, true once enabled", async () => {
      rows.findOne.mockResolvedValueOnce(null);
      await expect(svc.isEnabled("a1")).resolves.toBe(false);
      rows.findOne.mockResolvedValueOnce(row());
      await expect(svc.isEnabled("a1")).resolves.toBe(false);
      rows.findOne.mockResolvedValueOnce(row({ enabledAt: NOW }));
      await expect(svc.isEnabled("a1")).resolves.toBe(true);
    });
  });

  describe("beginSetup", () => {
    it("409 when the factor is already enabled", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW }));
      const err = await apiError(svc.beginSetup("a1", "a@b.com"));
      expect(err.status).toBe(HttpStatus.CONFLICT);
      expect(err.code).toBe("twoFactor.alreadyEnabled");
      expect(rows.save).not.toHaveBeenCalled();
    });

    it("stores a sealed fresh secret with nothing proved, and answers the secret with its uri", async () => {
      rows.findOne.mockResolvedValue(null);
      const res = await svc.beginSetup("a1", "a@b.com");
      expect(res.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(res.otpauthUri).toContain(`secret=${res.secret}`);
      expect(res.otpauthUri).toContain("a%40b.com");
      const saved = rows.save.mock.calls[0][0] as AccountTwoFactor;
      expect(saved).toMatchObject({ accountId: "a1", enabledAt: null, lastUsedStep: null, recoveryCodes: [] });
      expect(saved.secretCipher).not.toContain(res.secret);
      expect(decryptSecret(saved.secretCipher, PEPPER)).toBe(res.secret);
    });

    it("replaces a pending secret when asked again", async () => {
      rows.findOne.mockResolvedValue(row());
      const first = await svc.beginSetup("a1", "a@b.com");
      const second = await svc.beginSetup("a1", "a@b.com");
      expect(second.secret).not.toBe(first.secret);
      expect(rows.save).toHaveBeenCalledTimes(2);
    });

    it("throws when the pepper is unset", async () => {
      delete process.env.MANAGER_API_TOKEN_PEPPER;
      rows.findOne.mockResolvedValue(null);
      await expect(svc.beginSetup("a1", "a@b.com")).rejects.toThrow(/MANAGER_API_TOKEN_PEPPER/);
    });
  });

  describe("enable", () => {
    it("400 with no setup pending", async () => {
      rows.findOne.mockResolvedValue(null);
      const err = await apiError(svc.enable("a1", codeNow()));
      expect(err.status).toBe(HttpStatus.BAD_REQUEST);
      expect(err.code).toBe("twoFactor.noSetupPending");
    });

    it("409 when already enabled", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW }));
      const err = await apiError(svc.enable("a1", codeNow()));
      expect(err.status).toBe(HttpStatus.CONFLICT);
      expect(err.code).toBe("twoFactor.alreadyEnabled");
    });

    it("400 on a wrong code, journaled as a refusal, and nothing enabled", async () => {
      rows.findOne.mockResolvedValue(row());
      const err = await apiError(svc.enable("a1", wrongCode()));
      expect(err.status).toBe(HttpStatus.BAD_REQUEST);
      expect(err.code).toBe("twoFactor.invalidCode");
      expect(rows.save).not.toHaveBeenCalled();
      expect(activity.record).toHaveBeenCalledWith({ action: "auth.two-factor.refused", actorId: "a1" });
    });

    it("enables the factor on the right code, remembers its step and mints eight recovery codes, hashed at rest", async () => {
      const pending = row();
      rows.findOne.mockResolvedValue(pending);
      const res = await svc.enable("a1", codeNow());
      expect(res.recoveryCodes).toHaveLength(8);
      expect(pending.enabledAt).toEqual(NOW);
      expect(pending.lastUsedStep).toBe(String(totpStep(NOW.getTime())));
      expect(pending.recoveryCodes).toEqual(res.recoveryCodes.map((code) => hashRecoveryCode(code, PEPPER)));
      expect(rows.save).toHaveBeenCalledWith(pending);
      expect(activity.record).toHaveBeenCalledWith({ action: "auth.two-factor.enabled", actorId: "a1" });
    });

    it("throws when the stored secret cannot be opened with this pepper", async () => {
      rows.findOne.mockResolvedValue(row({ secretCipher: encryptSecret(SECRET, "another-pepper") }));
      await expect(svc.enable("a1", codeNow())).rejects.toThrow(/cannot be opened with this pepper/);
    });
  });

  describe("lockout", () => {
    it("stops checking codes after five refusals, and checks again fifteen minutes later", async () => {
      rows.findOne.mockResolvedValue(row());
      for (let i = 0; i < 5; i += 1) expect((await apiError(svc.enable("a1", wrongCode()))).code).toBe("twoFactor.invalidCode");
      const locked = await apiError(svc.enable("a1", codeNow()));
      expect(locked.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(locked.code).toBe("twoFactor.tooManyAttempts");
      vi.advanceTimersByTime(15 * 60_000 + 1);
      await expect(svc.enable("a1", codeNow())).resolves.toMatchObject({ recoveryCodes: expect.any(Array) });
    });

    it("forgets the refusals once a code is accepted", async () => {
      rows.findOne.mockResolvedValue(row());
      for (let i = 0; i < 4; i += 1) await apiError(svc.enable("a1", wrongCode()));
      await svc.enable("a1", codeNow());
      rows.findOne.mockResolvedValue(row());
      for (let i = 0; i < 4; i += 1) expect((await apiError(svc.enable("a1", wrongCode()))).code).toBe("twoFactor.invalidCode");
    });

    it("locks one account without touching another", async () => {
      rows.findOne.mockResolvedValue(row());
      for (let i = 0; i < 5; i += 1) await apiError(svc.enable("a1", wrongCode()));
      rows.findOne.mockResolvedValue(row({ accountId: "a2" }));
      await expect(svc.enable("a2", codeNow())).resolves.toMatchObject({ recoveryCodes: expect.any(Array) });
    });
  });

  describe("disable", () => {
    it("400 when the factor is not enabled", async () => {
      rows.findOne.mockResolvedValue(row());
      const err = await apiError(svc.disable("a1", codeNow()));
      expect(err.status).toBe(HttpStatus.BAD_REQUEST);
      expect(err.code).toBe("twoFactor.notEnabled");
      expect(rows.delete).not.toHaveBeenCalled();
    });

    it("400 on a wrong code and keeps the row", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW }));
      expect((await apiError(svc.disable("a1", wrongCode()))).code).toBe("twoFactor.invalidCode");
      expect(rows.delete).not.toHaveBeenCalled();
    });

    it("removes the row on a code from the app", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW }));
      await expect(svc.disable("a1", codeNow())).resolves.toEqual({ disabled: true });
      expect(rows.delete).toHaveBeenCalledWith({ accountId: "a1" });
      expect(activity.record).toHaveBeenCalledWith({ action: "auth.two-factor.disabled", actorId: "a1" });
    });

    it("removes the row on a recovery code too", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW, recoveryCodes: [hashRecoveryCode("ABCDE-FGHJK", PEPPER)] }));
      await expect(svc.disable("a1", "abcde fghjk")).resolves.toEqual({ disabled: true });
      expect(rows.delete).toHaveBeenCalledWith({ accountId: "a1" });
    });

    it("refuses a code from a step already used", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW, lastUsedStep: String(totpStep(NOW.getTime())) }));
      expect((await apiError(svc.disable("a1", codeNow()))).code).toBe("twoFactor.invalidCode");
    });
  });

  describe("regenerateRecoveryCodes", () => {
    it("400 when the factor is not enabled", async () => {
      rows.findOne.mockResolvedValue(null);
      expect((await apiError(svc.regenerateRecoveryCodes("a1", codeNow()))).code).toBe("twoFactor.notEnabled");
    });

    it("refuses a recovery code: only the app can print a new sheet", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW, recoveryCodes: [hashRecoveryCode("ABCDE-FGHJK", PEPPER)] }));
      expect((await apiError(svc.regenerateRecoveryCodes("a1", "ABCDE-FGHJK"))).code).toBe("twoFactor.invalidCode");
    });

    it("replaces the whole set on a code from the app", async () => {
      const enabled = row({ enabledAt: NOW, recoveryCodes: ["old"] });
      rows.findOne.mockResolvedValue(enabled);
      const res = await svc.regenerateRecoveryCodes("a1", codeNow());
      expect(res.recoveryCodes).toHaveLength(8);
      expect(enabled.recoveryCodes).toEqual(res.recoveryCodes.map((code) => hashRecoveryCode(code, PEPPER)));
      expect(enabled.lastUsedStep).toBe(String(totpStep(NOW.getTime())));
      expect(activity.record).toHaveBeenCalledWith({ action: "auth.two-factor.recovery-codes-regenerated", actorId: "a1" });
    });
  });

  describe("verifyForLogin", () => {
    it("is false with no row or a pending setup", async () => {
      rows.findOne.mockResolvedValueOnce(null);
      await expect(svc.verifyForLogin("a1", codeNow())).resolves.toBe(false);
      rows.findOne.mockResolvedValueOnce(row());
      await expect(svc.verifyForLogin("a1", codeNow())).resolves.toBe(false);
    });

    it("accepts the app's code once and remembers its step", async () => {
      const enabled = row({ enabledAt: NOW });
      rows.findOne.mockResolvedValue(enabled);
      await expect(svc.verifyForLogin("a1", codeNow())).resolves.toBe(true);
      expect(enabled.lastUsedStep).toBe(String(totpStep(NOW.getTime())));
      await expect(svc.verifyForLogin("a1", codeNow())).resolves.toBe(false);
    });

    it("spends a recovery code for good", async () => {
      const keep = hashRecoveryCode("ZZZZZ-ZZZZZ", PEPPER);
      const enabled = row({ enabledAt: NOW, recoveryCodes: [keep, hashRecoveryCode("ABCDE-FGHJK", PEPPER)] });
      rows.findOne.mockResolvedValue(enabled);
      await expect(svc.verifyForLogin("a1", "ABCDE-FGHJK")).resolves.toBe(true);
      expect(enabled.recoveryCodes).toEqual([keep]);
      expect(rows.save).toHaveBeenCalledWith(enabled);
      await expect(svc.verifyForLogin("a1", "ABCDE-FGHJK")).resolves.toBe(false);
    });

    it("is false on a wrong code, without a refusal counted against the authenticated routes", async () => {
      rows.findOne.mockResolvedValue(row({ enabledAt: NOW }));
      await expect(svc.verifyForLogin("a1", wrongCode())).resolves.toBe(false);
      expect(rows.save).not.toHaveBeenCalled();
      expect(activity.record).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("removes the row without a code and journals it on the account", async () => {
      await expect(svc.reset("a1")).resolves.toEqual({ reset: true });
      expect(rows.delete).toHaveBeenCalledWith({ accountId: "a1" });
      expect(activity.record).toHaveBeenCalledWith({
        action: "auth.two-factor.reset",
        subjectId: "a1",
        entity: { type: "account", id: "a1" },
      });
    });

    it("answers false, and journals nothing, when there was nothing to remove", async () => {
      rows.delete.mockResolvedValue({ affected: 0 });
      await expect(svc.reset("a1")).resolves.toEqual({ reset: false });
      expect(activity.record).not.toHaveBeenCalled();
    });

    it("treats a driver that reports no count as nothing removed", async () => {
      rows.delete.mockResolvedValue({});
      await expect(svc.reset("a1")).resolves.toEqual({ reset: false });
    });
  });
});
