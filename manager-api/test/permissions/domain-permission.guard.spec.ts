import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import type { Repository } from "typeorm";
import { CustomPermissionGuardConfigError } from "@naskot/custom-permission-guard";
import { DomainPermissionGuard } from "../../src/core/custom-permission-guard/domain-permission.guard";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { cpgMock, providerMock, repoMock, type CpgMock, type Loose } from "../helpers/mocks";

// A cpgMock, same controllable shape as test/helpers/e2e.ts makeCpgMock: an
// assertOne that resolves only for a granted (resource, action) pair, so every
// real branch of the guard (ownership, bridge, domains:access prerequisite,
// per-resource assert) runs against it.
type GuardCpg = CpgMock & {
  grantGlobal: (resource: string, ...actions: string[]) => void;
  grantDomain: (domainId: number, resource: string, ...actions: string[]) => void;
};

function makeCpg(): GuardCpg {
  const cpg = cpgMock();
  const global = new Set<string>();
  const domain = new Set<string>();
  cpg.guard.assertOne.global.mockImplementation(async (_uid: string, resource: string, opts: { acrud: string[] }) => {
    for (const a of opts.acrud) if (!global.has(`${resource}:${a}`)) throw new ForbiddenException(`Missing ${resource}:${a}`);
  });
  cpg.guard.assertOne.domain.mockImplementation(
    async (_uid: string, domainId: number, resource: string, opts: { acrud: string[] }) => {
      for (const a of opts.acrud)
        if (!domain.has(`${domainId}:${resource}:${a}`)) throw new ForbiddenException(`Missing ${domainId}:${resource}:${a}`);
    }
  );
  return Object.assign(cpg, {
    grantGlobal: (resource: string, ...actions: string[]) => actions.forEach((a) => global.add(`${resource}:${a}`)),
    grantDomain: (domainId: number, resource: string, ...actions: string[]) =>
      actions.forEach((a) => domain.add(`${domainId}:${resource}:${a}`)),
  });
}

// The guard only reads getHandler()/getClass() (handed to the mocked Reflector)
// and switchToHttp().getRequest(). ExecutionContextHost is Nest's own concrete
// ExecutionContext, so nothing has to be faked and nothing is cast.
function makeCtx(req: Record<string, unknown>): ExecutionContext {
  return new ExecutionContextHost([req], class {}, () => undefined);
}

// Non-root user, valid numeric :domainId, GET request -- the common preamble
// so each test only sets the requirement and the grants it is about.
function req(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "u", username: "u", isRoot: false },
    params: { domainId: "1" },
    method: "GET",
    originalUrl: "/api/v1/domains/1/recipients",
    ...overrides,
  };
}

describe("DomainPermissionGuard", () => {
  let reflector: Loose<Reflector>;
  let cpg: GuardCpg;
  let domains: Loose<Repository<VirtualDomain>>;
  let guard: DomainPermissionGuard;

  beforeEach(() => {
    reflector = providerMock<Reflector>({ getAllAndOverride: vi.fn() });
    cpg = makeCpg();
    // Default: the target domain exists but is owned by someone else, so the
    // ownership bypass never fires unless a test opts in.
    domains = repoMock<VirtualDomain>();
    domains.findOne.mockResolvedValue({ id: 1, ownerId: "other" });
    guard = new DomainPermissionGuard(reflector, cpg, domains);
  });

  it("allows when no requirement is declared", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeCtx(req()))).resolves.toBe(true);
    expect(domains.findOne).not.toHaveBeenCalled();
  });

  it("allows when the requirement list is empty", async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    await expect(guard.canActivate(makeCtx(req()))).resolves.toBe(true);
  });

  it("forbids when a requirement exists but no user is authenticated", async () => {
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx(req({ user: undefined })))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows root without touching the domain repo or the library", async () => {
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx(req({ user: { id: "r", isRoot: true } })))).resolves.toBe(true);
    expect(domains.findOne).not.toHaveBeenCalled();
    expect(cpg.guard.assertOne.domain).not.toHaveBeenCalled();
  });

  it("throws a configuration Error when :domainId is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx(req({ params: {} })))).rejects.toThrow(/numeric :domainId/);
  });

  it("throws a configuration Error when :domainId is non-numeric", async () => {
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx(req({ params: { domainId: "abc" } })))).rejects.toThrow(/numeric :domainId/);
  });

  it("allows the domain owner without any grant", async () => {
    domains.findOne.mockResolvedValue({ id: 1, ownerId: "u" });
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access", "list-recipients"] }]);
    await expect(guard.canActivate(makeCtx(req()))).resolves.toBe(true);
    expect(cpg.guard.assertOne.domain).not.toHaveBeenCalled();
    expect(cpg.guard.assertOne.global).not.toHaveBeenCalled();
  });

  it("bridges the `domain` resource through the global `domains` resource when granted", async () => {
    cpg.grantGlobal("domains", "view-domain");
    reflector.getAllAndOverride.mockReturnValue([{ resource: "domain", actions: ["view-domain"] }]);
    await expect(guard.canActivate(makeCtx(req()))).resolves.toBe(true);
    expect(cpg.guard.assertOne.global).toHaveBeenCalledWith("u", "domains", { acrud: ["view-domain"] });
    expect(cpg.guard.assertOne.domain).not.toHaveBeenCalled();
  });

  it("proceeds past a missing domain (null row) and still resolves via the bridge", async () => {
    domains.findOne.mockResolvedValue(null);
    cpg.grantGlobal("domains", "view-domain");
    reflector.getAllAndOverride.mockReturnValue([{ resource: "domain", actions: ["view-domain"] }]);
    await expect(guard.canActivate(makeCtx(req()))).resolves.toBe(true);
  });

  it("falls back to the domain tier when the bridge does not grant the `domain` action", async () => {
    cpg.grantGlobal("domains", "access");
    cpg.grantDomain(1, "domain", "access", "view-domain");
    reflector.getAllAndOverride.mockReturnValue([{ resource: "domain", actions: ["view-domain"] }]);
    await expect(guard.canActivate(makeCtx(req()))).resolves.toBe(true);
    expect(cpg.guard.assertOne.domain).toHaveBeenCalledWith("u", 1, "domain", { acrud: ["access"] });
    expect(cpg.guard.assertOne.domain).toHaveBeenCalledWith("u", 1, "domain", { acrud: ["view-domain"] });
  });

  it("forbids when the global domains:access prerequisite is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx(req()))).rejects.toThrow(/domains:access/);
  });

  it("forbids when the domain-scoped domain.access gate is missing", async () => {
    cpg.grantGlobal("domains", "access");
    // domains:access held globally, but domain.access not granted for this domain
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access"] }]);
    await expect(guard.canActivate(makeCtx(req()))).rejects.toBeInstanceOf(ForbiddenException);
    expect(cpg.guard.assertOne.domain).toHaveBeenCalledWith("u", 1, "domain", { acrud: ["access"] });
  });

  it("allows a non-root user holding the full domain-tier chain", async () => {
    cpg.grantGlobal("domains", "access");
    cpg.grantDomain(1, "domain", "access");
    cpg.grantDomain(1, "recipients", "access", "list-recipients");
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access", "list-recipients"] }]);
    await expect(guard.canActivate(makeCtx(req()))).resolves.toBe(true);
    expect(cpg.guard.assertOne.domain).toHaveBeenCalledWith("u", 1, "recipients", { acrud: ["access", "list-recipients"] });
  });

  it("forbids when the per-resource domain assertion fails", async () => {
    cpg.grantGlobal("domains", "access");
    cpg.grantDomain(1, "domain", "access");
    // recipients not granted for the domain
    reflector.getAllAndOverride.mockReturnValue([{ resource: "recipients", actions: ["access", "list-recipients"] }]);
    await expect(guard.canActivate(makeCtx(req()))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rethrows a CustomPermissionGuardConfigError instead of turning it into a 403", async () => {
    cpg.guard.assertOne.global.mockRejectedValue(new CustomPermissionGuardConfigError("bad schema"));
    reflector.getAllAndOverride.mockReturnValue([{ resource: "domain", actions: ["view-domain"] }]);
    await expect(guard.canActivate(makeCtx(req()))).rejects.toBeInstanceOf(CustomPermissionGuardConfigError);
  });
});
