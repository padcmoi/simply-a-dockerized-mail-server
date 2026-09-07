import { describe, it, expect, beforeEach, vi } from "vitest";
import { MfaService } from "../../src/core/auth/mfa/mfa.service";
import { hashAnswer } from "../../src/core/auth/mfa/security-answer";
import { SECURITY_QUESTIONS } from "../../src/core/auth/mfa/security-questions";
import type { ActivityLogService } from "../../src/core/activity/activity-log.service";
import type { AccountMfa } from "../../src/core/entities/account-mfa.entity";
import { entity, providerMock, repoMock } from "../helpers/mocks";

const PEPPER = "pepper-under-test";

function makeMocks() {
  const rows = repoMock<AccountMfa>();
  rows.save.mockImplementation(async (x: object) => x);
  return { rows, activity: providerMock<ActivityLogService>({ record: vi.fn(async () => undefined) }) };
}

describe("MfaService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MfaService;

  beforeEach(() => {
    process.env.MANAGER_API_TOKEN_PEPPER = PEPPER;
    m = makeMocks();
    svc = new MfaService(m.rows, m.activity);
  });

  describe("the security question", () => {
    it("is reported as unset when no row carries an answer, catalogue included", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ question: "father", answerHash: null }));
      expect(await svc.status("a1")).toEqual({ set: false, question: null, catalogue: SECURITY_QUESTIONS });
      expect(await svc.hasQuestion("a1")).toBe(false);
    });

    it("gives the question's key back, never the answer", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ question: "father", answerHash: hashAnswer("Joel", PEPPER) }));
      expect(await svc.status("a1")).toEqual({ set: true, question: "father", catalogue: SECURITY_QUESTIONS });
      expect(await svc.questionOf("a1")).toBe("father");
    });

    // A key the catalogue has dropped can no longer be displayed in any
    // language: the account is asked to choose again rather than shown blank.
    it("treats a question the API no longer offers as none at all", async () => {
      m.rows.findOne.mockResolvedValue(
        entity<AccountMfa>({ question: "favourite-colour", answerHash: hashAnswer("Joel", PEPPER) })
      );
      expect(await svc.questionOf("a1")).toBeNull();
      expect(await svc.status("a1")).toMatchObject({ set: false, question: null });
    });

    it("stores the answer as a keyed hash and the question as its key", async () => {
      m.rows.findOne.mockResolvedValue(null);
      expect(await svc.setQuestion("a1", "father", "Joël")).toEqual({
        set: true,
        question: "father",
        catalogue: SECURITY_QUESTIONS,
      });
      expect(m.rows.save).toHaveBeenCalledWith(
        expect.objectContaining({ question: "father", answerHash: hashAnswer("joel", PEPPER) })
      );
      expect(m.activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.security-question.set" }));
    });

    it("accepts the answer however it is typed", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ answerHash: hashAnswer("Joël", PEPPER) }));
      expect(await svc.verifyAnswer("a1", " JOEL ")).toBe(true);
    });

    it("refuses another answer, and an account with no question at all", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ answerHash: hashAnswer("Joel", PEPPER) }));
      expect(await svc.verifyAnswer("a1", "Michel")).toBe(false);
      m.rows.findOne.mockResolvedValue(null);
      expect(await svc.verifyAnswer("a1", "Joel")).toBe(false);
    });

    it("shuts the question for a while after five wrong answers in a row", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ answerHash: hashAnswer("Joel", PEPPER) }));
      for (let i = 0; i < 5; i += 1) expect(await svc.verifyAnswer("a1", "Michel")).toBe(false);
      await expect(svc.verifyAnswer("a1", "Joel")).rejects.toMatchObject({ status: 429 });
    });

    it("forgets the failures as soon as one answer lands", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ answerHash: hashAnswer("Joel", PEPPER) }));
      await svc.verifyAnswer("a1", "Michel");
      expect(await svc.verifyAnswer("a1", "Joel")).toBe(true);
      for (let i = 0; i < 4; i += 1) await svc.verifyAnswer("a1", "Michel");
      expect(await svc.verifyAnswer("a1", "Joel")).toBe(true);
    });
  });

  describe("chosen once and never again", () => {
    it("refuses to replace a question that already carries an answer", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ accountId: "a1", question: "father", answerHash: "h" }));
      await expect(svc.setQuestion("a1", "birthCity", "Nice")).rejects.toMatchObject({ status: 409 });
      expect(m.rows.save).not.toHaveBeenCalled();
    });

    it("takes the first question on a row that carries none yet", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ accountId: "a1", question: null, answerHash: null }));
      await expect(svc.setQuestion("a1", "father", "Joel")).resolves.toMatchObject({ set: true });
    });
  });

  describe("the accounts of a list that carry a question", () => {
    it("asks nothing for an empty page", async () => {
      expect(await svc.questionSetAmong([])).toEqual(new Set());
      expect(m.rows.find).not.toHaveBeenCalled();
    });

    it("names those whose answer is on record, in one read", async () => {
      m.rows.find.mockResolvedValue([
        entity<AccountMfa>({ accountId: "a1", answerHash: "h" }),
        entity<AccountMfa>({ accountId: "a2", answerHash: null }),
      ]);
      expect(await svc.questionSetAmong(["a1", "a2"])).toEqual(new Set(["a1"]));
      expect(m.rows.find).toHaveBeenCalledTimes(1);
    });

    it("names none rather than throwing when the table cannot be read", async () => {
      m.rows.find.mockRejectedValue(new Error("Table 'account_mfa' doesn't exist"));
      expect(await svc.questionSetAmong(["a1"])).toEqual(new Set());
    });
  });

  describe("an administrator clearing the question", () => {
    it("removes the question and the answer", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ accountId: "a1", question: "father", answerHash: "h" }));
      expect(await svc.resetQuestion("a1")).toEqual({ reset: true });
      expect(m.rows.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: "a1", question: null, answerHash: null }));
      expect(m.activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.security-question.reset" }));
    });

    it("answers `reset: false` for an account that had none", async () => {
      m.rows.findOne.mockResolvedValue(null);
      expect(await svc.resetQuestion("a1")).toEqual({ reset: false });
      expect(m.rows.save).not.toHaveBeenCalled();
    });

    // Cleared, the account is asked again at its next sign-in: that is what the
    // whole reset is for.
    it("leaves the account with nothing set, so it is asked again", async () => {
      const row = entity<AccountMfa>({ accountId: "a1", question: "father", answerHash: "h" });
      m.rows.findOne.mockResolvedValue(row);
      await svc.resetQuestion("a1");
      m.rows.findOne.mockResolvedValue(row);
      expect(await svc.questionState("a1")).toBe("missing");
    });
  });

  describe("questionState", () => {
    it("tells a missing question from an unreadable one", async () => {
      m.rows.findOne.mockResolvedValue(entity<AccountMfa>({ answerHash: "h" }));
      expect(await svc.questionState("a1")).toBe("set");
      m.rows.findOne.mockResolvedValue(null);
      expect(await svc.questionState("a1")).toBe("missing");
      m.rows.findOne.mockRejectedValue(new Error("Table 'account_mfa' doesn't exist"));
      expect(await svc.questionState("a1")).toBe("unknown");
    });
  });

  it("refuses to work at all without a pepper, rather than hashing with nothing", async () => {
    delete process.env.MANAGER_API_TOKEN_PEPPER;
    m.rows.findOne.mockResolvedValue(null);
    await expect(svc.setQuestion("a1", "father", "Joel")).rejects.toThrow("MANAGER_API_TOKEN_PEPPER");
  });
});
