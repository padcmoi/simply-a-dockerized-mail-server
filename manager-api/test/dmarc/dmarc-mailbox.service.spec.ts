import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { DataSource, EntityManager } from "typeorm";
import type { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { DmarcMailboxService } from "../../src/core/dmarc/dmarc-mailbox.service";
import { asReservedLocalPart, dmarcReportsAddress, reservedLocalPartOf } from "../../src/core/common/reserved-mailboxes";
import { entity, providerMock, repoMock } from "../helpers/mocks";

describe("DmarcMailboxService", () => {
  let domains: ReturnType<typeof repoMock<VirtualDomain>>;
  let manager: ReturnType<typeof providerMock<EntityManager>>;
  let existing: Map<string, Partial<VirtualUser>>;
  let svc: DmarcMailboxService;

  beforeEach(() => {
    existing = new Map();
    domains = repoMock<VirtualDomain>();
    domains.find.mockResolvedValue([
      entity<VirtualDomain>({ domain: "a.test" }),
      entity<VirtualDomain>({ domain: "b.test" }),
      entity<VirtualDomain>({ domain: "c.test" }),
    ]);
    manager = providerMock<EntityManager>({ findOne: vi.fn(), save: vi.fn() });
    manager.findOne.mockImplementation(
      async (_entity: unknown, options: { where: { email: string } }) => existing.get(options.where.email) ?? null
    );
    manager.save.mockImplementation(async (_entity: unknown, value: object) => value);
    const transaction = vi.fn();
    transaction.mockImplementation(async (work: (m: EntityManager) => unknown) => work(manager));
    svc = new DmarcMailboxService(domains, providerMock<DataSource>({ transaction }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("creates the missing mailboxes, turns a disabled one back on and leaves the others alone", async () => {
    existing.set("dmarc_reports@b.test", { id: 2, email: "dmarc_reports@b.test", active: 0 });
    existing.set("dmarc_reports@c.test", { id: 3, email: "dmarc_reports@c.test", active: 1 });

    await expect(svc.ensureAll()).resolves.toEqual({ created: 1, reactivated: 1, present: 1, failed: 0 });
    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "dmarc_reports@a.test", domain: "a.test", active: 1, maildir: "a.test/dmarc_reports/" })
    );
    expect(manager.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 2, active: 1 }));
  });

  it("carries on past a domain that fails", async () => {
    manager.save.mockRejectedValueOnce(new Error("db"));
    await expect(svc.ensureAll()).resolves.toMatchObject({ failed: 1, created: 2 });
  });

  it("survives a database that cannot list the domains", async () => {
    domains.find.mockRejectedValue(new Error("down"));
    await expect(svc.ensureAll()).resolves.toMatchObject({ created: 0, failed: 0 });
  });

  it("does nothing at bootstrap under the test runner, and everything outside it", async () => {
    await svc.onApplicationBootstrap();
    expect(domains.find).not.toHaveBeenCalled();
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    await svc.onApplicationBootstrap();
    expect(domains.find).toHaveBeenCalled();
  });
});

describe("the reserved mailboxes", () => {
  it("recognises the reserved local parts, whatever their case", () => {
    expect(asReservedLocalPart("Postmaster")).toBe("postmaster");
    expect(asReservedLocalPart("DMARC_Reports")).toBe("dmarc_reports");
    expect(asReservedLocalPart("dmarc")).toBeNull();
  });

  it("recognises a reserved address of the given domain only", () => {
    expect(reservedLocalPartOf("dmarc_reports@X.test", "x.test")).toBe("dmarc_reports");
    expect(reservedLocalPartOf("dmarc_reports@y.test", "x.test")).toBeNull();
    expect(reservedLocalPartOf("dmarc_reports_old@x.test", "x.test")).toBeNull();
  });

  it("writes the report address of a domain in lower case", () => {
    expect(dmarcReportsAddress("Example.COM")).toBe("dmarc_reports@example.com");
  });
});
