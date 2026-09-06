import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import type { HttpArgumentsHost } from "@nestjs/common/interfaces";
import { SecurityQuestionGuard } from "../../src/core/auth/mfa/security-question.guard";
import type { MfaService } from "../../src/core/auth/mfa/mfa.service";
import { providerMock } from "../helpers/mocks";

type FakeRequest = {
  originalUrl: string;
  headers: Record<string, string>;
  user?: { id: string };
};

function contextOf(req: FakeRequest) {
  const http = providerMock<HttpArgumentsHost>({ getRequest: vi.fn().mockReturnValue(req) });
  return providerMock<ExecutionContext>({ switchToHttp: vi.fn(() => http) });
}

const session = (url: string): FakeRequest => ({
  originalUrl: url,
  headers: { authorization: "Bearer access-token" },
  user: { id: "a1" },
});

describe("SecurityQuestionGuard", () => {
  let mfa: ReturnType<typeof providerMock<MfaService>>;
  let guard: SecurityQuestionGuard;

  beforeEach(() => {
    mfa = providerMock<MfaService>({ questionState: vi.fn(async () => "missing" as const) });
    guard = new SecurityQuestionGuard(mfa);
  });

  it("stops an account that has no question anywhere else in the API", async () => {
    await expect(guard.canActivate(contextOf(session("/api/v1/domains")))).rejects.toMatchObject({ status: 403 });
  });

  it("lets it through to read and set its question", async () => {
    expect(await guard.canActivate(contextOf(session("/api/v1/auth/jwt/me/security-question")))).toBe(true);
  });

  it("lets it read its own profile, which is how the interface learns it has to", async () => {
    expect(await guard.canActivate(contextOf(session("/api/v1/auth/jwt/me")))).toBe(true);
  });

  it("does not confuse a longer path with an allowed one", async () => {
    await expect(guard.canActivate(contextOf(session("/api/v1/auth/jwt/me/sessions")))).rejects.toMatchObject({
      status: 403,
    });
  });

  it("ignores the query string when deciding", async () => {
    expect(await guard.canActivate(contextOf(session("/api/v1/auth/jwt/me?with=groups")))).toBe(true);
  });

  it("says nothing to an account whose question is set", async () => {
    mfa.questionState.mockResolvedValue("set");
    expect(await guard.canActivate(contextOf(session("/api/v1/domains")))).toBe(true);
  });

  // The state of every server between a deploy and its migration: refusing over
  // a table that does not exist yet would take the whole manager down.
  it("says nothing when the question cannot be read at all", async () => {
    mfa.questionState.mockResolvedValue("unknown");
    expect(await guard.canActivate(contextOf(session("/api/v1/domains")))).toBe(true);
  });

  it("leaves an unauthenticated request to the guard whose job that is", async () => {
    const req: FakeRequest = { originalUrl: "/api/v1/domains", headers: { authorization: "Bearer x" } };
    expect(await guard.canActivate(contextOf(req))).toBe(true);
    expect(mfa.questionState).not.toHaveBeenCalled();
  });

  // A key acts for a machine that will never see a question.
  it("never stops an API key", async () => {
    const req: FakeRequest = { originalUrl: "/api/v1/domains", headers: { "x-api-key": "k" }, user: { id: "a1" } };
    expect(await guard.canActivate(contextOf(req))).toBe(true);
    expect(mfa.questionState).not.toHaveBeenCalled();
  });
});
