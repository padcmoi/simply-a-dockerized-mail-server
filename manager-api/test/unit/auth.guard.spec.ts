import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { CombinedAuthGuard } from "../../src/core/auth/auth.guard";
import { AUTH_PUBLIC_KEY, AUTH_STRATEGIES_KEY } from "../../src/core/auth/auth.decorator";

function makeCtx(reqInit: Record<string, unknown>): { ctx: ExecutionContext; req: Record<string, unknown> } {
  const req = { headers: {}, ...reqInit } as Record<string, unknown>;
  const ctx = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe("CombinedAuthGuard", () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let jwt: { verifyAsync: ReturnType<typeof vi.fn> };
  let apiTokens: { validate: ReturnType<typeof vi.fn> };
  let guard: CombinedAuthGuard;

  // The guard reads two metadata keys off the same reflector; branch on the key.
  function reflect(isPublic: unknown, strategies: unknown) {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === AUTH_PUBLIC_KEY) return isPublic;
      if (key === AUTH_STRATEGIES_KEY) return strategies;
      return undefined;
    });
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    jwt = { verifyAsync: vi.fn() };
    apiTokens = { validate: vi.fn() };
    guard = new CombinedAuthGuard(reflector as never, jwt as never, apiTokens as never);
  });

  it("allows any request on a @Public route", async () => {
    reflect(true, undefined);
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(apiTokens.validate).not.toHaveBeenCalled();
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it("authenticates a valid x-api-key and attaches the user", async () => {
    reflect(undefined, ["ApiToken"]);
    apiTokens.validate.mockResolvedValue({ id: "u", isRoot: false });
    const { ctx, req } = makeCtx({ headers: { "x-api-key": "key123" }, ip: "1.2.3.4" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(apiTokens.validate).toHaveBeenCalledWith("key123", "1.2.3.4");
    expect(req.user).toEqual({ id: "u", isRoot: false });
  });

  it("passes an empty string as ip when req.ip is absent", async () => {
    reflect(undefined, ["ApiToken"]);
    apiTokens.validate.mockResolvedValue({ id: "u" });
    const { ctx } = makeCtx({ headers: { "x-api-key": "key123" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(apiTokens.validate).toHaveBeenCalledWith("key123", "");
  });

  it("skips the ApiToken strategy when x-api-key is not a string", async () => {
    reflect(undefined, ["ApiToken"]);
    const { ctx } = makeCtx({ headers: { "x-api-key": ["a", "b"] } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(apiTokens.validate).not.toHaveBeenCalled();
  });

  it("falls through to Unauthorized when the api token does not validate", async () => {
    reflect(undefined, ["ApiToken", "JWT"]);
    apiTokens.validate.mockResolvedValue(null);
    const { ctx } = makeCtx({ headers: { "x-api-key": "bad" } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("authenticates a valid JWT Bearer token (root flag preserved)", async () => {
    reflect(undefined, ["JWT"]);
    jwt.verifyAsync.mockResolvedValue({ sub: "u", email: "e@test", isRoot: true });
    const { ctx, req } = makeCtx({ headers: { authorization: "Bearer good.token" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith("good.token", { secret: process.env.MANAGER_JWT_ACCESS_SECRET });
    expect(req.user).toEqual({ id: "u", email: "e@test", isRoot: true });
  });

  it("defaults isRoot to false when the payload does not mark it true", async () => {
    reflect(undefined, ["JWT"]);
    jwt.verifyAsync.mockResolvedValue({ sub: "u", email: "e@test" });
    const { ctx, req } = makeCtx({ headers: { authorization: "Bearer good.token" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: "u", email: "e@test", isRoot: false });
  });

  it("rejects a JWT whose payload carries no subject", async () => {
    reflect(undefined, ["JWT"]);
    jwt.verifyAsync.mockResolvedValue({ sub: undefined });
    const { ctx } = makeCtx({ headers: { authorization: "Bearer good.token" } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("swallows a JWT verification error and ends Unauthorized", async () => {
    reflect(undefined, ["JWT"]);
    jwt.verifyAsync.mockRejectedValue(new Error("jwt expired"));
    const { ctx } = makeCtx({ headers: { authorization: "Bearer bad.token" } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("skips an authorization header that is not a Bearer token", async () => {
    reflect(undefined, ["JWT"]);
    const { ctx } = makeCtx({ headers: { authorization: "Basic abc" } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it("defaults to both strategies when no @Auth annotation is present", async () => {
    reflect(undefined, undefined);
    jwt.verifyAsync.mockResolvedValue({ sub: "u", email: "e@test", isRoot: false });
    const { ctx, req } = makeCtx({ headers: { authorization: "Bearer good.token" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: "u" });
  });

  it("throws Unauthorized when every active strategy fails", async () => {
    reflect(undefined, undefined);
    const { ctx } = makeCtx({ headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("does not try ApiToken when the route restricts to JWT only", async () => {
    reflect(undefined, ["JWT"]);
    jwt.verifyAsync.mockResolvedValue({ sub: "u", email: "e@test" });
    const { ctx } = makeCtx({ headers: { "x-api-key": "key123", authorization: "Bearer good.token" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(apiTokens.validate).not.toHaveBeenCalled();
  });
});
