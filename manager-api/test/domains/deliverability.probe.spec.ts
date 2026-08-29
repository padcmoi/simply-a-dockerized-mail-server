import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const { askProbe, readStoredReport, storeReport } = vi.hoisted(() => ({
  askProbe: vi.fn(),
  readStoredReport: vi.fn(),
  storeReport: vi.fn(),
}));
vi.mock("../../src/api/domains/deliverability/deliverability.probe", () => ({ askProbe }));
vi.mock("../../src/api/domains/deliverability/deliverability.store", () => ({ readStoredReport, storeReport }));

import { DeliverabilityService } from "../../src/api/domains/deliverability/deliverability.service";
import { ApiError } from "../../src/core/common/api-error";
import type { DkimKeyEntity } from "../../src/core/entities/dkim-key.entity";
import type { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { entity, qbMock, repoMock } from "../helpers/mocks";

const PROBE_DIR = join(__dirname, "..", "..", "..", "images", "deliverability-probe");

describe("the deliverability probe image", () => {
  // One directory per tested element, discovered at boot by the probe itself.
  // Nothing declares the list, which is what makes adding a check cheap and what
  // makes these two mistakes possible: a directory that declares nothing, and
  // two directories claiming the same id, the second silently overwriting the
  // first's row in the report.
  const modules = readdirSync(PROBE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, source: readFileSync(join(PROBE_DIR, entry.name, "check.py"), "utf8") }));

  it("holds every check in a directory named after what it tests", () => {
    expect(modules.length).toBeGreaterThan(25);
    expect(modules.map((m) => m.name)).toContain("relay_access_denied");
  });

  it("has each of them declare an id, a section and a place in the order", () => {
    for (const { name, source } of modules) {
      expect(source, `${name} declares no ID`).toMatch(/^ID\s*=\s*"[a-z0-9-]+"/m);
      expect(source, `${name} declares no SECTION`).toMatch(/^SECTION\s*=\s*"(identity|dns|server|reputation)"/m);
      expect(source, `${name} declares no ORDER`).toMatch(/^ORDER\s*=\s*\d+/m);
      expect(source, `${name} defines no run()`).toMatch(/^def run\(ctx\)/m);
    }
  });

  it("never lets two of them claim the same id", () => {
    const ids = modules.map(({ source }) => /^ID\s*=\s*"([^"]+)"/m.exec(source)?.[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("DeliverabilityService", () => {
  let dkimKeys: ReturnType<typeof repoMock<DkimKeyEntity>>;
  let recipients: ReturnType<typeof repoMock<VirtualUser>>;
  let aliases: ReturnType<typeof repoMock<VirtualAlias>>;
  let svc: DeliverabilityService;
  let deliverable: ReturnType<typeof qbMock<VirtualUser>>;

  const answer = {
    domain: "example.org",
    mxHost: "mail.example.org",
    mailIp: "203.0.113.10",
    source: "198.51.100.4",
    counts: { pass: 1, warn: 0, fail: 0 },
    checks: [{ id: "open-relay", section: "server", status: "pass", evidence: "554 Relay access denied" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dkimKeys = repoMock<DkimKeyEntity>();
    recipients = repoMock<VirtualUser>();
    aliases = repoMock<VirtualAlias>();
    svc = new DeliverabilityService(dkimKeys, recipients, aliases);
    dkimKeys.findOne.mockResolvedValue(entity<DkimKeyEntity>({ domain: "example.org", selector: "dkim202608" }));
    // A role address is held when postfix would deliver to it, which is a
    // narrower question than whether a row bears its name: the recipient count
    // says the row exists, the query builder says it is deliverable.
    deliverable = qbMock<VirtualUser>();
    deliverable.getCount.mockResolvedValue(1);
    recipients.createQueryBuilder.mockReturnValue(deliverable);
    recipients.count.mockResolvedValue(1);
    aliases.count.mockResolvedValue(0);
    askProbe.mockResolvedValue({ report: answer, error: null });
    readStoredReport.mockResolvedValue(null);
    storeReport.mockResolvedValue(undefined);
  });

  // Guessing selector names proves nothing, so the probe is told which one the
  // server signs with. That value lives in this database and nowhere else.
  it("hands the probe the selector the manager knows, rather than letting it guess", async () => {
    await svc.report("example.org", true);
    expect(askProbe).toHaveBeenCalledWith("example.org", "dkim202608");
  });

  it("still asks when no key is recorded, so the probe can say so itself", async () => {
    dkimKeys.findOne.mockResolvedValue(null);
    await svc.report("example.org", true);
    expect(askProbe).toHaveBeenCalledWith("example.org", "");
  });

  // The two checks the probe cannot make from outside: whether the role
  // addresses exist is a question for this database.
  it("adds the role addresses to what the probe found, and counts the whole thing", async () => {
    recipients.count.mockResolvedValue(0);
    deliverable.getCount.mockResolvedValue(0);
    aliases.count.mockResolvedValue(0);
    const report = await svc.report("example.org", true);

    expect(report.checks.map((c) => c.id)).toEqual(["open-relay", "role-postmaster", "role-abuse"]);
    expect(report.counts).toEqual({ pass: 1, warn: 0, fail: 2 });
    expect(report.probedFrom).toBe("198.51.100.4");
  });

  it("accepts a role address served by an alias as well as by a mailbox", async () => {
    recipients.count.mockResolvedValue(0);
    deliverable.getCount.mockResolvedValue(0);
    aliases.count.mockResolvedValue(1);
    const report = await svc.report("example.org", true);
    expect(report.checks.find((c) => c.id === "role-postmaster")?.status).toBe("pass");
  });

  // Creating a domain provisions a postmaster mailbox that is disabled, and
  // counting rows called that green: the address exists and every message to it
  // bounces. What is asked now is what postfix asks.
  it("does not call a disabled mailbox a working role address, and says which it is", async () => {
    recipients.count.mockResolvedValue(1);
    deliverable.getCount.mockResolvedValue(0);
    aliases.count.mockResolvedValue(0);

    const report = await svc.report("example.org", true);
    const postmaster = report.checks.find((c) => c.id === "role-postmaster");
    expect(postmaster?.status).toBe("fail");
    expect(postmaster?.evidence).toBe("postmaster@example.org exists but is disabled");
  });

  it("says the address is missing when no row bears its name at all", async () => {
    recipients.count.mockResolvedValue(0);
    deliverable.getCount.mockResolvedValue(0);
    aliases.count.mockResolvedValue(0);

    const report = await svc.report("example.org", true);
    expect(report.checks.find((c) => c.id === "role-abuse")?.evidence).toBe("abuse@example.org does not exist");
  });

  // A run opens an SMTP session, fetches an HTTPS policy and queries public
  // blocklists in this installation's name. Opening the page must not spend
  // that: it reads what was kept, and only the button pays for a new one.
  it("serves the stored report without running anything", async () => {
    readStoredReport.mockResolvedValue({ ...answer, checkedAt: "2026-08-29T11:50:08.506Z", probedFrom: "51.68.127.3" });

    const report = await svc.report("example.org");
    expect(askProbe).not.toHaveBeenCalled();
    expect(report.checkedAt).toBe("2026-08-29T11:50:08.506Z");
  });

  it("runs and keeps the answer when nothing is stored yet", async () => {
    readStoredReport.mockResolvedValue(null);

    await svc.report("example.org");
    expect(askProbe).toHaveBeenCalled();
    expect(storeReport).toHaveBeenCalledWith(expect.objectContaining({ domain: "example.org" }));
  });

  it("ignores what is stored when a new run is asked for, and replaces it", async () => {
    readStoredReport.mockResolvedValue({ ...answer, checkedAt: "2026-01-01T00:00:00.000Z", probedFrom: "" });

    await svc.report("example.org", true);
    expect(readStoredReport).not.toHaveBeenCalled();
    expect(storeReport).toHaveBeenCalled();
  });

  // The defect this whole rewrite exists to remove: a page that answers when it
  // does not know. A silent probe has to break the request, never produce a
  // report the reader would take for a diagnosis.
  it("fails loudly when the probe does not answer, instead of reporting anything", async () => {
    askProbe.mockResolvedValue({ report: null, error: "timeout" });
    await expect(svc.report("example.org", true)).rejects.toBeInstanceOf(ApiError);
    // The code travels in the response body, which is what the interface reads.
    const raised = await svc.report("example.org", true).catch((e: ApiError) => e.getResponse());
    expect(raised).toMatchObject({ code: "deliverability.probeUnavailable", statusCode: 503 });
  });
});
