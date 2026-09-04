import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Repository } from "typeorm";
import { DkimCheckService } from "../../src/api/domains/dkim-check/dkim-check.service";
import { DkimKeyEntity } from "../../src/core/entities/dkim-key.entity";
import { type Loose, repoMock } from "../helpers/mocks";

// resolveTxt is the only external touch-point; mock the whole module so no DNS
// query ever leaves the process. vi.mock is hoisted above the imports.
vi.mock("node:dns/promises", () => ({ resolveTxt: vi.fn() }));
import { resolveTxt } from "node:dns/promises";
const resolveTxtMock = vi.mocked(resolveTxt);

const KEY = {
  domain: "example.com",
  selector: "dkim202602",
  dnsName: "dkim202602._domainkey",
  txtRecord: "v=DKIM1; k=rsa; p=ABC123",
};

describe("DkimCheckService (DNS TXT verification)", () => {
  let repo: Loose<Repository<DkimKeyEntity>>;
  let svc: DkimCheckService;

  beforeEach(() => {
    resolveTxtMock.mockReset();
    repo = repoMock<DkimKeyEntity>();
    svc = new DkimCheckService(repo);
  });

  it("reports no key (both expected and found null) when the DB has none", async () => {
    repo.findOne.mockResolvedValue(null);
    const out = await svc.check("example.com");
    expect(out).toMatchObject({
      hasKeyInDatabase: false,
      match: false,
      expected: null,
      found: null,
      error: null,
      staleSelectorFound: null,
    });
    expect(resolveTxtMock).not.toHaveBeenCalled();
  });

  it("matches when the published TXT (multi-chunk) carries the same p= value", async () => {
    repo.findOne.mockResolvedValue(KEY);
    resolveTxtMock.mockResolvedValue([["v=DKIM1; k=rsa; ", "p=ABC123"]]);
    const out = await svc.check("example.com");
    expect(resolveTxtMock).toHaveBeenCalledWith("dkim202602._domainkey.example.com");
    expect(out.match).toBe(true);
    expect(out.hasKeyInDatabase).toBe(true);
    expect(out.found).toEqual({ value: "v=DKIM1; k=rsa; p=ABC123" });
    expect(out.expected).toEqual({
      selector: "dkim202602",
      queriedName: "dkim202602._domainkey.example.com",
      value: KEY.txtRecord,
    });
  });

  it("flags a mismatch when the published p= value differs", async () => {
    repo.findOne.mockResolvedValue(KEY);
    resolveTxtMock.mockResolvedValue([["v=DKIM1; p=DIFFERENT"]]);
    const out = await svc.check("example.com");
    expect(out.match).toBe(false);
    expect(out.found).toEqual({ value: "v=DKIM1; p=DIFFERENT" });
  });

  it("falls back to the first record when none contains p= (mismatch)", async () => {
    repo.findOne.mockResolvedValue(KEY);
    resolveTxtMock.mockResolvedValue([["some-unrelated-record"]]);
    const out = await svc.check("example.com");
    expect(out.match).toBe(false);
    expect(out.found).toEqual({ value: "some-unrelated-record" });
  });

  it("reports found: null when DNS returns no records at all", async () => {
    repo.findOne.mockResolvedValue(KEY);
    resolveTxtMock.mockResolvedValue([]);
    const out = await svc.check("example.com");
    expect(out.match).toBe(false);
    expect(out.found).toBeNull();
  });

  it("on a DNS error, surfaces the previous monthly selector still published (stale hint)", async () => {
    repo.findOne.mockResolvedValue(KEY);
    resolveTxtMock.mockRejectedValueOnce(new Error("ENOTFOUND")).mockResolvedValueOnce([["v=DKIM1; p=STALEKEY"]]);
    const out = await svc.check("example.com");
    expect(resolveTxtMock).toHaveBeenNthCalledWith(2, "dkim202601._domainkey.example.com");
    expect(out.error).toBe("ENOTFOUND");
    expect(out.match).toBe(false);
    expect(out.found).toBeNull();
    expect(out.staleSelectorFound).toEqual({
      selector: "dkim202601",
      queriedName: "dkim202601._domainkey.example.com",
      txtRecord: "v=DKIM1; p=STALEKEY",
    });
  });

  it("on a DNS error, returns no stale hint when the previous selector is also gone", async () => {
    repo.findOne.mockResolvedValue(KEY);
    resolveTxtMock.mockRejectedValueOnce(new Error("ENOTFOUND")).mockRejectedValueOnce(new Error("ENOTFOUND"));
    const out = await svc.check("example.com");
    expect(out.staleSelectorFound).toBeNull();
    expect(out.error).toBe("ENOTFOUND");
  });

  it("on a DNS error, returns no stale hint when the previous selector resolves empty", async () => {
    repo.findOne.mockResolvedValue(KEY);
    resolveTxtMock.mockRejectedValueOnce(new Error("ENOTFOUND")).mockResolvedValueOnce([]);
    const out = await svc.check("example.com");
    expect(out.staleSelectorFound).toBeNull();
  });

  it("on a DNS error with a non-monthly selector, skips the stale lookup entirely", async () => {
    repo.findOne.mockResolvedValue({ ...KEY, selector: "default", dnsName: "default._domainkey" });
    // Non-Error rejection also exercises the String(err) branch.
    resolveTxtMock.mockRejectedValueOnce("dns exploded");
    const out = await svc.check("example.com");
    expect(out.error).toBe("dns exploded");
    expect(out.staleSelectorFound).toBeNull();
    expect(resolveTxtMock).toHaveBeenCalledTimes(1);
  });
});
