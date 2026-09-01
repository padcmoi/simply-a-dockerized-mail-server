import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { HttpArgumentsHost } from "@nestjs/common/interfaces";
import type { Request, Response } from "express";
import { PassportAuthController } from "../../src/core/auth/passport/passport.controller";
import { PassportProviderGuard } from "../../src/core/auth/passport/passport.guard";
import { PassportExchangeStore } from "../../src/core/auth/passport/passport-exchange.store";
import type { PassportAuthService } from "../../src/core/auth/passport/passport.service";
import type { ProviderIdentity } from "../../src/core/auth/passport/passport-providers";
import { entity, providerMock, type Loose } from "../helpers/mocks";

// The guard reads two things off the request: the :provider segment, and the
// page to come back to.
function ctx(params: Record<string, string>, query: Record<string, string> = {}) {
  // getRequest is generic on Nest's side, hence the single parameter cast: the
  // guard asks it for the Express request this builds.
  const req = entity<Request>({ params, query });
  const http = entity<HttpArgumentsHost>({ getRequest: <T>() => req as T });
  return entity<ExecutionContext>({ switchToHttp: () => http });
}

// Express always fills `query`, so a double that leaves it out is not a request
// the controller can ever be handed.
function callbackReq(over: Partial<Request & { user?: ProviderIdentity }> = {}) {
  return entity<Request & { user?: ProviderIdentity }>({ query: {}, ...over });
}

describe("PassportAuthController", () => {
  let passport: Loose<PassportAuthService>;
  let ctrl: PassportAuthController;
  let res: Loose<Response>;

  beforeEach(() => {
    passport = providerMock<PassportAuthService>({
      publicProviders: vi.fn(() => [{ id: "google", label: "Google" }]),
      redeem: vi.fn(),
      codeForIdentity: vi.fn(),
      loginRedirect: vi.fn(
        (p: Record<string, string>, returnTo?: string | null) => `${returnTo ?? "/login"}?${new URLSearchParams(p).toString()}`
      ),
    });
    ctrl = new PassportAuthController(passport);
    res = providerMock<Response>({ redirect: vi.fn() });
  });

  it("lists the providers the login screen may draw", () => {
    expect(ctrl.providers()).toEqual([{ id: "google", label: "Google" }]);
  });

  it("trades a one-time code for a session, forwarding the device fingerprint", async () => {
    await ctrl.exchange({ code: "c".repeat(20) }, "UA/1.0", "1.2.3.4");
    expect(passport.redeem).toHaveBeenCalledWith("c".repeat(20), "UA/1.0", "1.2.3.4");
  });

  it("leaves the start route to Passport, which answers with its own redirect", () => {
    expect(ctrl.start()).toBeUndefined();
  });

  describe("callback", () => {
    const identity = entity<ProviderIdentity>({ provider: "google", subject: "s" });

    it("sends the browser back with a one-time code when the identity resolves", async () => {
      passport.codeForIdentity.mockResolvedValue("the-code");

      await ctrl.callback(callbackReq({ user: identity }), res, "google");

      expect(res.redirect).toHaveBeenCalledWith("/login?provider_code=the-code");
    });

    it("sends a flat refusal when the provider left no identity", async () => {
      await ctrl.callback(callbackReq(), res, "google");

      expect(res.redirect).toHaveBeenCalledWith("/login?provider_error=refused&provider=google");
      expect(passport.codeForIdentity).not.toHaveBeenCalled();
    });

    it("answers the same flat refusal whatever the service refused for", async () => {
      passport.codeForIdentity.mockRejectedValue(new Error("no account here answers to this address"));

      await ctrl.callback(callbackReq({ user: identity }), res, "google");

      expect(res.redirect).toHaveBeenCalledWith("/login?provider_error=refused&provider=google");
    });

    // The page that started the sign-in is the one that has something left to
    // do with it: the invitation screen takes its grant once the session is
    // open, which it can only do if the browser comes back to it.
    it("comes back to the page the sign-in started from, code and refusal alike", async () => {
      passport.codeForIdentity.mockResolvedValue("the-code");
      const query = { state: "/invite/abc" };

      await ctrl.callback(callbackReq({ user: identity, query }), res, "google");
      expect(res.redirect).toHaveBeenCalledWith("/invite/abc?provider_code=the-code");

      await ctrl.callback(callbackReq({ query }), res, "google");
      expect(res.redirect).toHaveBeenCalledWith("/invite/abc?provider_error=refused&provider=google");
    });
  });
});

describe("PassportProviderGuard", () => {
  let passport: Loose<PassportAuthService>;
  let guard: PassportProviderGuard;

  beforeEach(() => {
    passport = providerMock<PassportAuthService>({
      isUsable: vi.fn(() => false),
      managerUrlSet: vi.fn(() => true),
      callbackUrl: vi.fn(() => "https://mgr.test/api/v1/auth/passport/google/callback"),
    });
    guard = new PassportProviderGuard(passport);
  });

  it("names the manager URL when that is what is missing, since an admin fixes it in the interface", async () => {
    passport.managerUrlSet.mockReturnValue(false);
    await expect(guard.canActivate(ctx({ provider: "google" }))).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(guard.canActivate(ctx({ provider: "google" }))).rejects.toThrow(/manager URL is not set/);
  });

  it("refuses an unusable provider before Passport is ever asked for a strategy", async () => {
    await expect(guard.canActivate(ctx({ provider: "google" }))).rejects.toThrow(/not available on this server/);
  });

  it("refuses a request with no provider segment at all", async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toThrow(/this provider/);
  });
});

describe("PassportExchangeStore", () => {
  it("hands back the account id once, and never again", () => {
    const store = new PassportExchangeStore();
    const code = store.mint("a1");
    expect(store.claim(code)).toBe("a1");
    expect(store.claim(code)).toBeNull();
  });

  it("refuses a code it never minted", () => {
    expect(new PassportExchangeStore().claim("nope")).toBeNull();
  });

  it("refuses a code past its thirty seconds, and sweeps it away", () => {
    vi.useFakeTimers();
    const store = new PassportExchangeStore();
    const code = store.mint("a1");
    vi.advanceTimersByTime(31_000);
    expect(store.claim(code)).toBeNull();
    // A later mint sweeps whatever expired before it.
    expect(typeof store.mint("a2")).toBe("string");
    vi.useRealTimers();
  });
});
