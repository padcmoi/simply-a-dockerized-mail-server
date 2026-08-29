import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const askProbe = vi.hoisted(() => vi.fn());
vi.mock("../../src/api/domains/deliverability/deliverability.probe", () => ({ askProbe }));

import { DeliverabilityService } from "../../src/api/domains/deliverability/deliverability.service";
import { ApiError } from "../../src/core/common/api-error";
import type { DkimKeyEntity } from "../../src/core/entities/dkim-key.entity";
import type { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { entity, repoMock } from "../helpers/mocks";

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
    recipients.count.mockResolvedValue(1);
    aliases.count.mockResolvedValue(0);
    askProbe.mockResolvedValue({ report: answer, error: null });
  });

  // Guessing selector names proves nothing, so the probe is told which one the
  // server signs with. That value lives in this database and nowhere else.
  it("hands the probe the selector the manager knows, rather than letting it guess", async () => {
    await svc.run("example.org");
    expect(askProbe).toHaveBeenCalledWith("example.org", "dkim202608");
  });

  it("still asks when no key is recorded, so the probe can say so itself", async () => {
    dkimKeys.findOne.mockResolvedValue(null);
    await svc.run("example.org");
    expect(askProbe).toHaveBeenCalledWith("example.org", "");
  });

  // The two checks the probe cannot make from outside: whether the role
  // addresses exist is a question for this database.
  it("adds the role addresses to what the probe found, and counts the whole thing", async () => {
    recipients.count.mockResolvedValue(0);
    aliases.count.mockResolvedValue(0);
    const report = await svc.run("example.org");

    expect(report.checks.map((c) => c.id)).toEqual(["open-relay", "role-postmaster", "role-abuse"]);
    expect(report.counts).toEqual({ pass: 1, warn: 2, fail: 0 });
    expect(report.probedFrom).toBe("198.51.100.4");
  });

  it("accepts a role address served by an alias as well as by a mailbox", async () => {
    recipients.count.mockResolvedValue(0);
    aliases.count.mockResolvedValue(1);
    const report = await svc.run("example.org");
    expect(report.checks.find((c) => c.id === "role-postmaster")?.status).toBe("pass");
  });

  // The defect this whole rewrite exists to remove: a page that answers when it
  // does not know. A silent probe has to break the request, never produce a
  // report the reader would take for a diagnosis.
  it("fails loudly when the probe does not answer, instead of reporting anything", async () => {
    askProbe.mockResolvedValue({ report: null, error: "timeout" });
    await expect(svc.run("example.org")).rejects.toBeInstanceOf(ApiError);
    // The code travels in the response body, which is what the interface reads.
    const raised = await svc.run("example.org").catch((e: ApiError) => e.getResponse());
    expect(raised).toMatchObject({ code: "deliverability.probeUnavailable", statusCode: 503 });
  });
});
