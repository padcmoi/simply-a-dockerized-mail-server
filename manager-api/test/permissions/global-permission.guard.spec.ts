import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { GlobalPermissionGuard } from "../../src/core/custom-permission-guard/global-permission.guard";
import { cpgMock, providerMock, type CpgMock, type Loose } from "../helpers/mocks";

// A cpgMock, same controllable shape as test/helpers/e2e.ts makeCpgMock:
// assertOne.global resolves only for a granted (resource, action) pair and
// throws ForbiddenException otherwise, so the guard's real branches (root
// bypass, per-entry assertion) run unchanged against it.
type GuardCpg = CpgMock & { grantGlobal: (resource: string, ...actions: string[]) => void };

function makeCpg(): GuardCpg {
  const cpg = cpgMock();
  const global = new Set<string>();
  cpg.guard.assertOne.global.mockImplementation(async (_uid: string, resource: string, opts: { acrud: string[] }) => {
    for (const a of opts.acrud) if (!global.has(`${resource}:${a}`)) throw new ForbiddenException(`Missing ${resource}:${a}`);
  });
  return Object.assign(cpg, {
    grantGlobal: (resource: string, ...actions: string[]) => actions.forEach((a) => global.add(`${resource}:${a}`)),
  });
}

// The guard only reads getHandler()/getClass() (handed to the mocked Reflector)
// and switchToHttp().getRequest(). ExecutionContextHost is Nest's own concrete
// ExecutionContext, so nothing has to be faked and nothing is cast.
function makeCtx(user?: unknown): ExecutionContext {
  return new ExecutionContextHost([{ user }], class {}, () => undefined);
}

describe("GlobalPermissionGuard", () => {
  let reflector: Loose<Reflector>;
  let cpg: GuardCpg;
  let guard: GlobalPermissionGuard;

  beforeEach(() => {
    reflector = providerMock<Reflector>({ getAllAndOverride: vi.fn() });
    cpg = makeCpg();
    guard = new GlobalPermissionGuard(reflector, cpg);
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
