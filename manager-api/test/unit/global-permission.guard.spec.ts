import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { GlobalPermissionGuard } from "../../src/core/custom-permission-guard/global-permission.guard";

// Inline stand-in for the permission library, same shape as test/helpers/e2e.ts
// makeCpgMock: assertOne.global resolves only for a granted (resource, action)
// pair and throws ForbiddenException otherwise, so the guard's real branches
// (root bypass, per-entry assertion) run unchanged against it.
function makeCpg() {
  const global = new Set<string>();
  return {
    guard: {
      assertOne: {
        global: vi.fn(async (_uid: string, resource: string, opts: { acrud: string[] }) => {
          for (const a of opts.acrud) if (!global.has(`${resource}:${a}`)) throw new ForbiddenException(`Missing ${resource}:${a}`);
        }),
        domain: vi.fn(),
      },
    },
    grantGlobal: (resource: string, ...actions: string[]) => actions.forEach((a) => global.add(`${resource}:${a}`)),
  };
}

function makeCtx(user?: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe("GlobalPermissionGuard", () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let cpg: ReturnType<typeof makeCpg>;
  let guard: GlobalPermissionGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    cpg = makeCpg();
    guard = new GlobalPermissionGuard(reflector as never, cpg as never);
  });

  it("allows when no requirement is declared (undefined metadata)", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeCtx({ id: "u", isRoot: false }))).resolves.toBe(true);
    expect(cpg.guard.assertOne.global).not.toHaveBeenCalled();
  });

  it("allows when the requirement list is empty", async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    await expect(guard.canActivate(makeCtx({ id: "u", isRoot: false }))).resolves.toBe(true);
    expect(cpg.guard.assertOne.global).not.toHaveBeenCalled();
  });

  it("forbids when a requirement exists but no user is authenticated", async () => {
    reflector.getAllAndOverride.mockReturnValue([{ resource: "sieve", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx(undefined))).rejects.toBeInstanceOf(ForbiddenException);
    expect(cpg.guard.assertOne.global).not.toHaveBeenCalled();
  });

  it("allows root without ever consulting the permission library", async () => {
    reflector.getAllAndOverride.mockReturnValue([{ resource: "sieve", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx({ id: "root", isRoot: true }))).resolves.toBe(true);
    expect(cpg.guard.assertOne.global).not.toHaveBeenCalled();
  });

  it("allows a non-root user that holds every required permission", async () => {
    cpg.grantGlobal("sieve", "access", "list-reject-senders");
    reflector.getAllAndOverride.mockReturnValue([{ resource: "sieve", actions: ["access", "list-reject-senders"] }]);
    await expect(guard.canActivate(makeCtx({ id: "u", isRoot: false }))).resolves.toBe(true);
    expect(cpg.guard.assertOne.global).toHaveBeenCalledWith("u", "sieve", { acrud: ["access", "list-reject-senders"] });
  });

  it("asserts every declared entry (AND across entries)", async () => {
    cpg.grantGlobal("sieve", "access");
    cpg.grantGlobal("rspamd", "access");
    reflector.getAllAndOverride.mockReturnValue([
      { resource: "sieve", actions: ["access"] },
      { resource: "rspamd", actions: ["access"] },
    ]);
    await expect(guard.canActivate(makeCtx({ id: "u", isRoot: false }))).resolves.toBe(true);
    expect(cpg.guard.assertOne.global).toHaveBeenCalledTimes(2);
  });

  it("forbids a non-root user missing a required permission", async () => {
    cpg.grantGlobal("sieve", "access");
    reflector.getAllAndOverride.mockReturnValue([{ resource: "sieve", actions: ["access", "delete-reject-sender"] }]);
    await expect(guard.canActivate(makeCtx({ id: "u", isRoot: false }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
