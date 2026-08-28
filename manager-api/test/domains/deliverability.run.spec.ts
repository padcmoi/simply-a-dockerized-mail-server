import { describe, it, expect, beforeEach, vi } from "vitest";

// The DNS and SMTP layers are the seam: they are doubled here so the service's
// own judgement - what counts as pass, warn, fail or skip - is what gets
// tested, against scenarios a real domain would take months to produce.
// `vi.mock` is hoisted above every const, so the doubles are built inside
// `vi.hoisted` - otherwise the factory runs before they exist.
const { dns, smtp } = vi.hoisted(() => ({
  dns: {
    resolver: vi.fn(() => ({})),
    authoritativeResolver: vi.fn(async () => null),
    attempt: vi.fn(),
    txt: vi.fn(),
    a: vi.fn(),
    aaaa: vi.fn(),
    ptr: vi.fn(),
    mx: vi.fn(),
    cname: vi.fn(),
    dnsbl: vi.fn(),
    nodeState: vi.fn(),
    reverseIp: vi.fn(),
  },
  smtp: { probeSmtp: vi.fn(), probeCertificate: vi.fn(), probeOpenRelay: vi.fn() },
}));

vi.mock("../../src/api/domains/deliverability/deliverability.dns", () => dns);
vi.mock("../../src/api/domains/deliverability/deliverability.smtp", () => smtp);

import { DeliverabilityService } from "../../src/api/domains/deliverability/deliverability.service";
import type { DkimKeyEntity } from "../../src/core/entities/dkim-key.entity";
import type { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import type { CheckStatus, DeliverabilityReport } from "../../src/api/domains/deliverability/deliverability.types";
import { entity, repoMock } from "../helpers/mocks";

const DOMAIN = "example.org";
const IP = "203.0.113.10";
const MX_HOST = "mail.example.org";

// A 2048 bit DKIM record, generated once and pinned: the key strength check
// reads the real modulus rather than trusting a declared length.
const REAL_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA30Cu" +
  "IiVR8aHahBH85"; // truncated on purpose: see the "unreadable key" case

describe("DeliverabilityService.run", () => {
  let dkimKeys: ReturnType<typeof repoMock<DkimKeyEntity>>;
  let recipients: ReturnType<typeof repoMock<VirtualUser>>;
  let aliases: ReturnType<typeof repoMock<VirtualAlias>>;
  let svc: DeliverabilityService;

  // The happy path, which each test then breaks in exactly one place.
  function healthy() {
    dns.mx.mockResolvedValue([{ exchange: `${MX_HOST}.`, priority: 10 }]);
    dns.a.mockImplementation(async (_r: unknown, name: string) => (name === MX_HOST ? [IP] : [IP]));
    dns.ptr.mockResolvedValue([`${MX_HOST}.`]);
    dns.cname.mockResolvedValue(null);
    dns.aaaa.mockResolvedValue(null);
    dns.nodeState.mockResolvedValue("exists");
    dns.dnsbl.mockResolvedValue({ verdict: "clean", codes: [] });
    dns.txt.mockImplementation(async (_r: unknown, name: string) => {
      if (name === DOMAIN) return ["v=spf1 ip4:203.0.113.10 -all"];
      if (name === `_dmarc.${DOMAIN}`) return ["v=DMARC1; p=reject; rua=mailto:d@example.org"];
      if (name.startsWith("dkim")) return [`v=DKIM1; k=rsa; p=${REAL_KEY}`];
      if (name === `_mta-sts.${DOMAIN}`) return ["v=STSv1; id=1"];
      if (name === `_smtp._tls.${DOMAIN}`) return ["v=TLSRPTv1; rua=mailto:t@example.org"];
      return null;
    });
    smtp.probeSmtp.mockResolvedValue({
      reachable: true,
      banner: "mail.example.org ESMTP",
      helo: MX_HOST,
      capabilities: ["STARTTLS"],
      startTls: true,
      error: null,
    });
    smtp.probeCertificate.mockResolvedValue({
      subject: MX_HOST,
      issuer: "R11",
      validTo: "",
      daysLeft: 60,
      altNames: [MX_HOST],
      error: null,
    });
    smtp.probeOpenRelay.mockResolvedValue({ verdict: "closed", reply: "554 Relay access denied" });
    recipients.count.mockResolvedValue(1);
    aliases.count.mockResolvedValue(0);
    dkimKeys.findOne.mockResolvedValue(entity<DkimKeyEntity>({ domain: DOMAIN, selector: "dkim202608" }));
  }

  const statusOf = (report: DeliverabilityReport, id: string): CheckStatus | undefined =>
    report.checks.find((c) => c.id === id)?.status;
  const evidenceOf = (report: DeliverabilityReport, id: string) => report.checks.find((c) => c.id === id)?.evidence ?? "";

  beforeEach(() => {
    vi.clearAllMocks();
    dkimKeys = repoMock<DkimKeyEntity>();
    recipients = repoMock<VirtualUser>();
    aliases = repoMock<VirtualAlias>();
    svc = new DeliverabilityService(dkimKeys, recipients, aliases);
    healthy();
  });

  describe("the shape of a report", () => {
    it("names the domain, the MX and the address every conclusion is about", async () => {
      const report = await svc.run(DOMAIN);
      expect(report).toMatchObject({ domain: DOMAIN, mxHost: MX_HOST, mailIp: IP });
      expect(Date.parse(report.checkedAt)).not.toBeNaN();
    });

    it("counts its own verdicts, and the tally matches the checks", async () => {
      const report = await svc.run(DOMAIN);
      const total = report.counts.pass + report.counts.warn + report.counts.fail + report.counts.skip;
      expect(total).toBe(report.checks.length);
      expect(report.checks.length).toBeGreaterThan(25);
    });

    it("gives every check a section the interface knows how to group", async () => {
      const report = await svc.run(DOMAIN);
      for (const check of report.checks) {
        expect(["identity", "dns", "server", "reputation"]).toContain(check.section);
      }
    });
  });

  describe("identity", () => {
    it("fails on a domain with no MX, and skips what depended on it rather than piling up failures", async () => {
      dns.mx.mockResolvedValue(null);
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "mx-present")).toBe("fail");
      expect(report.mailIp).toBeNull();
      expect(report.checks.find((c) => c.id === "smtp-reachable")).toBeUndefined();
    });

    it("fails when the MX name resolves to nothing", async () => {
      dns.a.mockResolvedValue(null);
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "mx-resolves")).toBe("fail");
    });

    it("fails a missing PTR and skips the two checks hanging off it", async () => {
      dns.ptr.mockResolvedValue(null);
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "ptr-present")).toBe("fail");
      expect(statusOf(report, "ptr-fcrdns")).toBe("skip");
      expect(statusOf(report, "ptr-not-cname")).toBe("skip");
    });

    // A one-way PTR counts for nothing: the name it gives must lead back to
    // the address it was read from.
    it("fails a PTR whose name resolves to another address", async () => {
      dns.ptr.mockResolvedValue(["someone-else.example.net."]);
      dns.a.mockImplementation(async (_r: unknown, name: string) => (name === MX_HOST ? [IP] : ["198.51.100.9"]));
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "ptr-fcrdns")).toBe("fail");
      expect(evidenceOf(report, "ptr-fcrdns")).toContain("198.51.100.9");
    });

    it("warns when the PTR points at a CNAME rather than a direct A", async () => {
      dns.cname.mockResolvedValue(["real.example.org"]);
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "ptr-not-cname")).toBe("warn");
    });

    // No IPv6 is a comfortable state: Gmail is stricter over v6, and it is
    // half-configured v6 that burns senders.
    it("passes an absent IPv6 and fails an IPv6 without a PTR", async () => {
      expect(statusOf(await svc.run(DOMAIN), "ipv6-consistent")).toBe("pass");

      dns.aaaa.mockResolvedValue(["2001:db8::1"]);
      dns.ptr.mockImplementation(async (_r: unknown, ip: string) => (ip === IP ? [`${MX_HOST}.`] : null));
      expect(statusOf(await svc.run(DOMAIN), "ipv6-consistent")).toBe("fail");
    });
  });

  describe("the neighbourhood of the address", () => {
    it("warns when the neighbours all carry a generic hosting name", async () => {
      dns.ptr.mockImplementation(async (_r: unknown, ip: string) =>
        ip === IP ? [`${MX_HOST}.`] : [`vps-${ip.replace(/\./g, "")}abcdef.vps.provider.net`]
      );
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "ip-neighbourhood")).toBe("warn");
      expect(evidenceOf(report, "ip-neighbourhood")).toMatch(/^\d+\/\d+ generic/);
    });

    it("passes when the neighbours are named servers", async () => {
      dns.ptr.mockImplementation(async (_r: unknown, ip: string) =>
        ip === IP ? [`${MX_HOST}.`] : ["mail.another-company.example"]
      );
      expect(statusOf(await svc.run(DOMAIN), "ip-neighbourhood")).toBe("pass");
    });

    it("skips rather than guesses when no neighbour answers at all", async () => {
      dns.ptr.mockImplementation(async (_r: unknown, ip: string) => (ip === IP ? [`${MX_HOST}.`] : null));
      expect(statusOf(await svc.run(DOMAIN), "ip-neighbourhood")).toBe("skip");
    });
  });

  describe("the server", () => {
    it("skips every server check when port 25 does not answer", async () => {
      smtp.probeSmtp.mockResolvedValue({ reachable: false, banner: "", helo: "", capabilities: [], startTls: false, error: "timeout" });
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "smtp-reachable")).toBe("fail");
      for (const id of ["helo-matches-ptr", "starttls", "tls-certificate", "open-relay"]) {
        expect(statusOf(report, id)).toBe("skip");
      }
    });

    it("warns when the HELO name is not the MX name", async () => {
      smtp.probeSmtp.mockResolvedValue({
        reachable: true,
        banner: "b",
        helo: "vps-1234.provider.net",
        capabilities: [],
        startTls: false,
        error: null,
      });
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "helo-matches-ptr")).toBe("warn");
      expect(statusOf(report, "starttls")).toBe("fail");
      expect(statusOf(report, "tls-certificate")).toBe("skip");
    });

    it("warns on a certificate about to expire and on one that does not cover the name", async () => {
      smtp.probeCertificate.mockResolvedValue({ subject: MX_HOST, issuer: "R11", validTo: "", daysLeft: 3, altNames: [], error: null });
      expect(statusOf(await svc.run(DOMAIN), "tls-certificate")).toBe("warn");

      smtp.probeCertificate.mockResolvedValue({ subject: "other.example", issuer: "R11", validTo: "", daysLeft: 90, altNames: [], error: null });
      expect(statusOf(await svc.run(DOMAIN), "tls-certificate")).toBe("warn");
    });

    it("fails when the certificate could not be read at all", async () => {
      smtp.probeCertificate.mockResolvedValue({ subject: "", issuer: "", validTo: "", daysLeft: 0, altNames: [], error: "handshake" });
      expect(statusOf(await svc.run(DOMAIN), "tls-certificate")).toBe("fail");
    });

    it("fails an open relay and skips the verdict when it could not be established", async () => {
      smtp.probeOpenRelay.mockResolvedValue({ verdict: "open", reply: "250 Ok" });
      expect(statusOf(await svc.run(DOMAIN), "open-relay")).toBe("fail");

      smtp.probeOpenRelay.mockResolvedValue({ verdict: "unknown", reply: "timeout" });
      expect(statusOf(await svc.run(DOMAIN), "open-relay")).toBe("skip");
    });

    it("warns when postmaster or abuse is nowhere, recipient or alias", async () => {
      recipients.count.mockResolvedValue(0);
      aliases.count.mockResolvedValue(0);
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "role-postmaster")).toBe("warn");
      expect(statusOf(report, "role-abuse")).toBe("warn");
    });

    it("accepts a role address served by an alias", async () => {
      recipients.count.mockResolvedValue(0);
      aliases.count.mockResolvedValue(1);
      expect(statusOf(await svc.run(DOMAIN), "role-postmaster")).toBe("pass");
    });
  });

  describe("SPF", () => {
    it("fails an absent record and skips everything that reads it", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name === DOMAIN ? [] : null));
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "spf-present")).toBe("fail");
      for (const id of ["spf-single", "spf-covers-ip", "spf-lookups", "spf-qualifier"]) {
        expect(statusOf(report, id)).toBe("skip");
      }
    });

    // Two records is not twice as safe: the RFC makes it a permerror.
    it("fails on two SPF records", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) =>
        name === DOMAIN ? ["v=spf1 mx ~all", "v=spf1 ip4:203.0.113.10 -all"] : null
      );
      expect(statusOf(await svc.run(DOMAIN), "spf-single")).toBe("fail");
    });

    it("accepts the sending address covered literally or through mx", async () => {
      expect(statusOf(await svc.run(DOMAIN), "spf-covers-ip")).toBe("pass");

      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name === DOMAIN ? ["v=spf1 mx -all"] : null));
      expect(statusOf(await svc.run(DOMAIN), "spf-covers-ip")).toBe("pass");
    });

    it("fails a record that authorises everything except the address actually sending", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) =>
        name === DOMAIN ? ["v=spf1 ip4:198.51.100.0/24 -all"] : null
      );
      expect(statusOf(await svc.run(DOMAIN), "spf-covers-ip")).toBe("fail");
    });

    it("fails past the ten lookup ceiling, which is a permerror in the wild", async () => {
      const includes = Array.from({ length: 11 }, (_, i) => `include:spf${i}.example`).join(" ");
      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name === DOMAIN ? [`v=spf1 ${includes} -all`] : null));
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "spf-lookups")).toBe("fail");
      expect(evidenceOf(report, "spf-lookups")).toBe("11/10");
    });

    it("passes a strict qualifier, warns on a softfail, fails when there is no all at all", async () => {
      expect(statusOf(await svc.run(DOMAIN), "spf-qualifier")).toBe("pass");

      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name === DOMAIN ? ["v=spf1 mx ~all"] : null));
      expect(statusOf(await svc.run(DOMAIN), "spf-qualifier")).toBe("warn");

      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name === DOMAIN ? ["v=spf1 mx"] : null));
      expect(statusOf(await svc.run(DOMAIN), "spf-qualifier")).toBe("fail");
    });
  });

  describe("DKIM", () => {
    it("fails when the _domainkey node holds nothing at all", async () => {
      dns.nodeState.mockResolvedValue("empty");
      expect(statusOf(await svc.run(DOMAIN), "dkim-node")).toBe("fail");
    });

    it("skips the node verdict when the lookup itself failed", async () => {
      dns.nodeState.mockResolvedValue("unknown");
      expect(statusOf(await svc.run(DOMAIN), "dkim-node")).toBe("skip");
    });

    it("fails when the manager holds no key for the domain, and skips what follows", async () => {
      dkimKeys.findOne.mockResolvedValue(null);
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "dkim-selector-known")).toBe("fail");
      for (const id of ["dkim-published", "dkim-key-strength", "dkim-not-testing"]) {
        expect(statusOf(report, id)).toBe("skip");
      }
    });

    // The trap this stack can walk into: monthly rotation without publishing.
    it("fails when the selector the server signs with is absent from DNS, and names it", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name.startsWith("dkim") ? null : [""]));
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "dkim-published")).toBe("fail");
      expect(report.checks.find((c) => c.id === "dkim-published")?.params).toMatchObject({ selector: "dkim202608" });
      expect(statusOf(report, "dkim-key-strength")).toBe("skip");
    });

    it("fails a published record whose key cannot be read", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) =>
        name.startsWith("dkim") ? ["v=DKIM1; k=rsa; p=not-a-key"] : null
      );
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "dkim-published")).toBe("pass");
      expect(statusOf(report, "dkim-key-strength")).toBe("fail");
    });

    it("warns on a record left in test mode, which tells verifiers to ignore the result", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) =>
        name.startsWith("dkim") ? [`v=DKIM1; k=rsa; t=y; p=${REAL_KEY}`] : null
      );
      expect(statusOf(await svc.run(DOMAIN), "dkim-not-testing")).toBe("warn");
    });
  });

  describe("DMARC", () => {
    it("fails an absent record and skips what reads it", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name === `_dmarc.${DOMAIN}` ? [] : null));
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "dmarc-present")).toBe("fail");
      expect(statusOf(report, "dmarc-policy")).toBe("skip");
      expect(statusOf(report, "dmarc-rua")).toBe("skip");
    });

    it("warns on p=none, which observes without protecting", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) =>
        name === `_dmarc.${DOMAIN}` ? ["v=DMARC1; p=none"] : null
      );
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "dmarc-policy")).toBe("warn");
      expect(statusOf(report, "dmarc-rua")).toBe("warn");
    });

    it("passes an enforcing policy that collects its reports", async () => {
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "dmarc-policy")).toBe("pass");
      expect(statusOf(report, "dmarc-rua")).toBe("pass");
    });
  });

  describe("transport records", () => {
    it("warns when MTA-STS and TLS-RPT are simply absent", async () => {
      dns.txt.mockImplementation(async (_r: unknown, name: string) => (name === DOMAIN ? ["v=spf1 -all"] : null));
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "mta-sts")).toBe("warn");
      expect(statusOf(report, "mta-sts-policy")).toBe("skip");
      expect(statusOf(report, "tls-rpt")).toBe("warn");
    });

    // The TXT alone announces a promise nothing keeps: the policy is fetched.
    it("fails when the record announces a policy the host does not serve", async () => {
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "mta-sts")).toBe("pass");
      expect(statusOf(report, "mta-sts-policy")).toBe("fail");
    });

    it("skips DANE, which only means something with DNSSEC", async () => {
      expect(statusOf(await svc.run(DOMAIN), "dane")).toBe("skip");
    });

    it("warns on a wildcard TXT, which answers for every name and confuses every lookup", async () => {
      dns.txt.mockResolvedValue(["v=spf1 -all"]);
      expect(statusOf(await svc.run(DOMAIN), "no-wildcard-txt")).toBe("warn");
    });
  });

  describe("reputation", () => {
    it("fails on a listing and names the list", async () => {
      dns.dnsbl.mockImplementation(async (_r: unknown, _ip: string, zone: string) =>
        zone === "zen.spamhaus.org" ? { verdict: "listed", codes: ["127.0.0.2"] } : { verdict: "clean", codes: [] }
      );
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "blocklists")).toBe("fail");
      expect(evidenceOf(report, "blocklists")).toContain("zen.spamhaus.org");
    });

    // The rule the whole page's honesty rests on.
    it("skips rather than passes when every list refused to answer", async () => {
      dns.dnsbl.mockResolvedValue({ verdict: "unavailable", codes: [] });
      expect(statusOf(await svc.run(DOMAIN), "blocklists")).toBe("skip");
    });

    it("passes when the lists that did answer are clean, and says how many did", async () => {
      const report = await svc.run(DOMAIN);
      expect(statusOf(report, "blocklists")).toBe("pass");
      expect(evidenceOf(report, "blocklists")).toMatch(/lists answered/);
    });

    it("warns when the address is on no whitelist, passes when dnswl lists it", async () => {
      expect(statusOf(await svc.run(DOMAIN), "dnswl")).toBe("warn");

      dns.dnsbl.mockResolvedValue({ verdict: "listed", codes: ["127.0.9.1"] });
      expect(statusOf(await svc.run(DOMAIN), "dnswl")).toBe("pass");
    });
  });
});
