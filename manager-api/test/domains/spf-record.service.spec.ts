import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as dns } from "dns";
import {
  SpfRecordService,
  ipv4InRange,
  recommendedSpfRecord,
  spfTerms,
} from "../../src/api/domains/spf-record/spf-record.service";

describe("the SPF record helpers", () => {
  it("tells whether an address sits in a range, a bare address being a /32", () => {
    expect(ipv4InRange("203.0.113.10", "203.0.113.0/24")).toBe(true);
    expect(ipv4InRange("203.0.113.10", "203.0.113.10")).toBe(true);
    expect(ipv4InRange("203.0.113.10", "203.0.113.11")).toBe(false);
    expect(ipv4InRange("203.0.113.10", "0.0.0.0/0")).toBe(true);
    expect(ipv4InRange("203.0.113.10", "203.0.113.0/33")).toBe(false);
    expect(ipv4InRange("203.0.113.10", "2001:db8::/32")).toBe(false);
    expect(ipv4InRange("nope", "203.0.113.0/24")).toBe(false);
  });

  it("splits a record into its terms, version aside", () => {
    expect(spfTerms("  v=spf1   mx  ip4:203.0.113.10 -all ")).toEqual(["mx", "ip4:203.0.113.10", "-all"]);
  });

  it("proposes mx, the server's addresses and -all for a domain that publishes nothing", () => {
    expect(recommendedSpfRecord(null, ["203.0.113.10"], false)).toBe("v=spf1 mx ip4:203.0.113.10 -all");
    expect(recommendedSpfRecord(null, [], false)).toBe("v=spf1 mx -all");
  });

  it("keeps every published term, putting the missing addresses in front, and its own ending", () => {
    expect(recommendedSpfRecord("v=spf1 include:_spf.example.net ~all", ["203.0.113.10"], false)).toBe(
      "v=spf1 ip4:203.0.113.10 include:_spf.example.net ~all"
    );
    expect(recommendedSpfRecord("v=spf1 ip4:203.0.113.10/32 a:x.test", ["203.0.113.10", "198.51.100.7"], false)).toBe(
      "v=spf1 ip4:198.51.100.7 ip4:203.0.113.10/32 a:x.test -all"
    );
    expect(recommendedSpfRecord("v=spf1 redirect=_spf.example.net", ["203.0.113.10"], false)).toBe(
      "v=spf1 ip4:203.0.113.10 redirect=_spf.example.net"
    );
  });

  it("leaves a record that already covers the server as it is", () => {
    expect(recommendedSpfRecord("v=spf1 mx -all", ["203.0.113.10"], true)).toBe("v=spf1 mx -all");
  });
});

describe("SpfRecordService", () => {
  let svc: SpfRecordService;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("MAIL_HOSTNAME", "Mail.Example.org");
    svc = new SpfRecordService();
    vi.spyOn(dns, "resolve4").mockImplementation(async (host: string) => {
      if (host === "mail.example.org" || host === "mx1.example.org") return ["203.0.113.10"];
      if (host === "example.org") return ["198.51.100.7"];
      throw Object.assign(new Error("nx"), { code: "ENOTFOUND" });
    });
    vi.spyOn(dns, "resolveMx").mockImplementation(async (domain: string) => {
      if (domain === "example.org") return [{ exchange: "mx1.example.org", priority: 10 }];
      throw Object.assign(new Error("nx"), { code: "ENODATA" });
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  const published = (...records: string[]) =>
    vi.spyOn(dns, "resolveTxt").mockResolvedValue(records.map((record) => [record.slice(0, 5), record.slice(5)]));

  it("describes a domain whose record covers the server through mx", async () => {
    published("google-site-verification=abc", "v=spf1 mx -all");
    await expect(svc.describe("Example.org")).resolves.toEqual({
      dnsName: "example.org",
      txtRecord: "v=spf1 mx -all",
      mailHost: "mail.example.org",
      ips: ["203.0.113.10"],
      published: "v=spf1 mx -all",
      multiple: false,
      covered: true,
      error: null,
    });
  });

  it("counts an address, an a host or a range as covering, never a failing or softfailing term", async () => {
    await expect(svc.authorizes("example.org", "v=spf1 ip4:203.0.113.0/24 -all", "203.0.113.10")).resolves.toBe(true);
    await expect(svc.authorizes("example.org", "v=spf1 +a:mail.example.org/24 -all", "203.0.113.10")).resolves.toBe(true);
    await expect(svc.authorizes("example.org", "v=spf1 mx:example.org -all", "203.0.113.10")).resolves.toBe(true);
    await expect(svc.authorizes("example.org", "v=spf1 a -all", "198.51.100.7")).resolves.toBe(true);
    await expect(
      svc.authorizes("example.org", "v=spf1 ~ip4:203.0.113.10 -ip4:203.0.113.10 ?mx -all", "203.0.113.10")
    ).resolves.toBe(false);
    await expect(
      svc.authorizes("example.org", "v=spf1 include:_spf.example.net a:gone.test mx:gone.test -all", "203.0.113.10")
    ).resolves.toBe(false);
  });

  it("adds the server to a record that leaves it out, and says when DNS answers two records", async () => {
    published("v=spf1 include:_spf.example.net ~all", "v=spf1 -all");
    const record = await svc.describe("example.org");
    expect(record).toMatchObject({
      txtRecord: "v=spf1 ip4:203.0.113.10 include:_spf.example.net ~all",
      published: "v=spf1 include:_spf.example.net ~all",
      multiple: true,
      covered: false,
    });
  });

  it("proposes a whole record when nothing is published, and says why", async () => {
    vi.spyOn(dns, "resolveTxt").mockRejectedValue(Object.assign(new Error("nx"), { code: "ENODATA" }));
    await expect(svc.describe("example.org")).resolves.toMatchObject({
      txtRecord: "v=spf1 mx ip4:203.0.113.10 -all",
      published: null,
      covered: false,
      error: "ENODATA",
    });
  });

  it("keeps the message of a lookup failure without a code, and covers nothing without a mail host", async () => {
    vi.stubEnv("MAIL_HOSTNAME", "");
    vi.spyOn(dns, "resolveTxt").mockRejectedValue(new Error("timeout"));
    await expect(svc.describe("example.org")).resolves.toMatchObject({ mailHost: "", ips: [], error: "timeout", covered: false });
    published("v=spf1 mx -all");
    await expect(svc.describe("example.org")).resolves.toMatchObject({ covered: false, txtRecord: "v=spf1 mx -all" });
  });
});
