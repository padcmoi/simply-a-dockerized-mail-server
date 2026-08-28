import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createPublicKey } from "node:crypto";
import { request } from "node:https";
import { Repository } from "typeorm";
import { DkimKeyEntity } from "../../../core/entities/dkim-key.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { a, aaaa, authoritativeResolver, cname, dnsbl, mx, nodeState, ptr, resolver, txt } from "./deliverability.dns";
import { probeCertificate, probeOpenRelay, probeSmtp } from "./deliverability.smtp";
import type { CheckResult, CheckSection, CheckStatus, DeliverabilityReport } from "./deliverability.types";

// The lists queried for the IP. Spamhaus is included knowing it refuses public
// resolvers: `dnsbl()` reports that refusal as "unavailable" rather than
// inventing a clean verdict (see deliverability.dns.ts).
const BLOCKLISTS = [
  "zen.spamhaus.org",
  "bl.spamcop.net",
  "b.barracudacentral.org",
  "dnsbl.sorbs.net",
  "psbl.surriel.com",
  "ix.dnsbl.manitu.net",
];
const WHITELIST = "list.dnswl.org";

@Injectable()
export class DeliverabilityService {
  private readonly log = new Logger(DeliverabilityService.name);

  constructor(
    @InjectRepository(DkimKeyEntity) private readonly dkimKeys: Repository<DkimKeyEntity>,
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>
  ) {}

  async run(domain: string): Promise<DeliverabilityReport> {
    const checks: CheckResult[] = [];
    const add = (
      id: string,
      section: CheckSection,
      status: CheckStatus,
      evidence = "",
      params?: Record<string, string | number>
    ) => checks.push({ id, section, status, evidence, ...(params ? { params } : {}) });

    const r = resolver();
    const mxHost = await this.resolveMx(r, domain, add);
    const mailIp = mxHost ? await this.resolveMailIp(r, mxHost, add) : null;

    if (mailIp) {
      await this.checkIdentity(r, mailIp, mxHost!, add);
      await this.checkServer(mailIp, mxHost!, add);
      await this.checkReputation(r, mailIp, add);
    }

    await this.checkSpf(r, domain, mailIp, add);
    await this.checkDkim(r, domain, add);
    await this.checkDmarc(r, domain, add);
    await this.checkTransportRecords(r, domain, mxHost, add);
    await this.checkRoleAddresses(domain, add);

    const counts = { pass: 0, warn: 0, fail: 0, skip: 0 };
    for (const c of checks) counts[c.status] += 1;

    return { domain, checkedAt: new Date().toISOString(), mailIp, mxHost, counts, checks };
  }

  // ---------------------------------------------------------------- identity

  private async resolveMx(r: ReturnType<typeof resolver>, domain: string, add: Adder): Promise<string | null> {
    const records = await mx(r, domain);
    if (!records?.length) {
      add("mx-present", "identity", "fail");
      return null;
    }
    const best = [...records].sort((x, y) => x.priority - y.priority)[0]!;
    add("mx-present", "identity", "pass", records.map((m) => `${m.priority} ${m.exchange}`).join(", "));
    return best.exchange.replace(/\.$/, "");
  }

  private async resolveMailIp(r: ReturnType<typeof resolver>, host: string, add: Adder): Promise<string | null> {
    const addresses = await a(r, host);
    if (!addresses?.length) {
      add("mx-resolves", "identity", "fail", host);
      return null;
    }
    add("mx-resolves", "identity", "pass", `${host} -> ${addresses.join(", ")}`);
    return addresses[0]!;
  }

  private async checkIdentity(r: ReturnType<typeof resolver>, ip: string, mxHost: string, add: Adder) {
    const names = await ptr(r, ip);
    const ptrName = names?.[0]?.replace(/\.$/, "") ?? null;
    if (!ptrName) {
      // Without a PTR most receivers refuse the mail outright, so everything
      // that hangs off it is skipped rather than reported as a second failure.
      add("ptr-present", "identity", "fail", ip);
      add("ptr-fcrdns", "identity", "skip");
      add("ptr-not-cname", "identity", "skip");
      return;
    }
    add("ptr-present", "identity", "pass", `${ip} -> ${ptrName}`);

    const back = await a(r, ptrName);
    add("ptr-fcrdns", "identity", back?.includes(ip) ? "pass" : "fail", `${ptrName} -> ${back?.join(", ") ?? "-"}`, { ip });

    const alias = await cname(r, ptrName);
    add("ptr-not-cname", "identity", alias?.length ? "warn" : "pass", alias?.join(", ") ?? ptrName);

    const v6 = await aaaa(r, mxHost);
    if (!v6?.length) {
      // No IPv6 at all is a valid, even comfortable, state: Gmail is markedly
      // stricter over v6, and half-configured v6 is what burns senders.
      add("ipv6-consistent", "identity", "pass", "no AAAA");
    } else {
      const v6Ptr = await ptr(r, v6[0]!);
      add("ipv6-consistent", "identity", v6Ptr?.length ? "pass" : "fail", `${v6[0]} -> ${v6Ptr?.join(", ") ?? "no PTR"}`);
    }

    await this.checkNeighbourhood(r, ip, add);
  }

  // Nothing else reports this, and it is often the whole answer: an address
  // alone among generic hosting names sits in a range scored as a block.
  private async checkNeighbourhood(r: ReturnType<typeof resolver>, ip: string, add: Adder) {
    const parts = ip.split(".");
    const last = Number(parts[3]);
    if (!Number.isFinite(last)) return add("ip-neighbourhood", "reputation", "skip");

    const offsets = [-4, -3, -2, -1, 1, 2, 3, 4];
    const neighbours = offsets
      .map((o) => last + o)
      .filter((n) => n > 0 && n < 255)
      .map((n) => `${parts[0]}.${parts[1]}.${parts[2]}.${n}`);

    const names = (await Promise.all(neighbours.map((n) => ptr(r, n)))).map((rows) => rows?.[0] ?? "");
    const answered = names.filter(Boolean);
    if (!answered.length) return add("ip-neighbourhood", "reputation", "skip");

    // Provider defaults look like vps-1a2b3c.vps.provider.net or
    // 51-77-200-98.static.host.tld: a hex or dotted-quad blob in the leftmost
    // label is the tell.
    const generic = answered.filter((n) =>
      /^(vps-?[0-9a-f]{6,}|ip-?\d+|\d+[-.]\d+[-.]\d+[-.]\d+|host[-.]?\d+|static[-.]?\d+)/i.test(n)
    );
    const ratio = generic.length / answered.length;
    add(
      "ip-neighbourhood",
      "reputation",
      ratio >= 0.75 ? "warn" : "pass",
      `${generic.length}/${answered.length} generic: ${answered.slice(0, 3).join(", ")}`,
      { generic: generic.length, total: answered.length }
    );
  }

  // ------------------------------------------------------------------ server

  private async checkServer(ip: string, mxHost: string, add: Adder) {
    const probe = await probeSmtp(ip);
    if (!probe.reachable) {
      add("smtp-reachable", "server", "fail", probe.error ?? "");
      for (const id of ["helo-matches-ptr", "starttls", "tls-certificate", "open-relay"]) add(id, "server", "skip");
      return;
    }
    add("smtp-reachable", "server", "pass", probe.banner);

    const heloName = probe.helo.split(/\s+/)[0] ?? "";
    add(
      "helo-matches-ptr",
      "server",
      heloName.toLowerCase() === mxHost.toLowerCase() ? "pass" : "warn",
      `${heloName} vs ${mxHost}`
    );

    add("starttls", "server", probe.startTls ? "pass" : "fail", probe.capabilities.join(" "));

    if (probe.startTls) {
      const cert = await probeCertificate(ip, mxHost);
      if (cert.error) add("tls-certificate", "server", "fail", cert.error);
      else {
        const covers = cert.subject === mxHost || cert.altNames.includes(mxHost);
        const expiring = cert.daysLeft < 15;
        add(
          "tls-certificate",
          "server",
          !covers ? "warn" : expiring ? "warn" : "pass",
          `CN=${cert.subject}, ${cert.daysLeft}d left, issuer ${cert.issuer}`,
          { days: cert.daysLeft }
        );
      }
    } else {
      add("tls-certificate", "server", "skip");
    }

    const relay = await probeOpenRelay(ip);
    add("open-relay", "server", relay.verdict === "open" ? "fail" : relay.verdict === "closed" ? "pass" : "skip", relay.reply);
  }

  // --------------------------------------------------------------------- SPF

  private async checkSpf(r: ReturnType<typeof resolver>, domain: string, mailIp: string | null, add: Adder) {
    const records = (await txt(r, domain)) ?? [];
    const spf = records.filter((v) => v.toLowerCase().startsWith("v=spf1"));

    if (!spf.length) {
      add("spf-present", "dns", "fail");
      for (const id of ["spf-single", "spf-covers-ip", "spf-lookups", "spf-qualifier"]) add(id, "dns", "skip");
      return;
    }
    add("spf-present", "dns", "pass", spf[0]!);
    // Two SPF records is not "twice as safe": the RFC makes the evaluation a
    // permerror, which is a hard failure for every receiver.
    add("spf-single", "dns", spf.length === 1 ? "pass" : "fail", `${spf.length} records`, { count: spf.length });

    const record = spf[0]!;
    const mechanisms = record.split(/\s+/).slice(1);

    if (mailIp) {
      const literal = mechanisms.some((m) => m.toLowerCase() === `ip4:${mailIp}` || m.toLowerCase().startsWith(`ip4:${mailIp}/`));
      const viaMx = mechanisms.some((m) => /^[+~?-]?mx$/i.test(m));
      add("spf-covers-ip", "dns", literal || viaMx ? "pass" : "fail", literal ? `ip4:${mailIp}` : viaMx ? "mx" : "not covered", {
        ip: mailIp,
      });
    } else add("spf-covers-ip", "dns", "skip");

    // The 10 lookup ceiling counts mechanisms that cost a query; blowing it is
    // a permerror, and it is the classic outcome of stacking `include:`.
    const costly = mechanisms.filter((m) => /^[+~?-]?(include|a|mx|ptr|exists|redirect)([:=]|$)/i.test(m)).length;
    add("spf-lookups", "dns", costly <= 10 ? "pass" : "fail", `${costly}/10`, { count: costly });

    const all = mechanisms.find((m) => /all$/i.test(m)) ?? "";
    add("spf-qualifier", "dns", all.startsWith("-") ? "pass" : all ? "warn" : "fail", all || "no all mechanism");
  }

  // -------------------------------------------------------------------- DKIM

  private async checkDkim(r: ReturnType<typeof resolver>, domain: string, add: Adder) {
    // Asked where the zone is authoritative: a cached NXDOMAIN would answer
    // "no key" for a record published minutes ago.
    const authoritative = (await authoritativeResolver(domain)) ?? r;
    const state = await nodeState(authoritative, `_domainkey.${domain}`);
    add("dkim-node", "dns", state === "exists" ? "pass" : state === "empty" ? "fail" : "skip", state);

    // The selector this stack signs with, read from the manager's own key row
    // rather than guessed: guessing selector names proves nothing.
    const key = await this.dkimKeys.findOne({ where: { domain }, order: { updatedAt: "DESC" } });
    if (!key) {
      add("dkim-selector-known", "dns", "fail");
      for (const id of ["dkim-published", "dkim-key-strength", "dkim-not-testing"]) add(id, "dns", "skip");
      return;
    }
    add("dkim-selector-known", "dns", "pass", key.selector);

    const published = (await txt(authoritative, `${key.selector}._domainkey.${domain}`))?.join("") ?? null;
    if (!published) {
      // The trap this stack can walk into: monthly selector rotation without
      // publishing the new record. Signing under a selector DNS does not know
      // is worse than not signing at all.
      add("dkim-published", "dns", "fail", `${key.selector}._domainkey.${domain}`, { selector: key.selector });
      for (const id of ["dkim-key-strength", "dkim-not-testing"]) add(id, "dns", "skip");
      return;
    }
    add("dkim-published", "dns", "pass", published.slice(0, 60) + (published.length > 60 ? "..." : ""));

    const bits = this.keyBits(published);
    add(
      "dkim-key-strength",
      "dns",
      bits === null ? "fail" : bits >= 2048 ? "pass" : bits >= 1024 ? "warn" : "fail",
      bits === null ? "unreadable public key" : `${bits} bits`,
      bits === null ? undefined : { bits }
    );

    const testing = /(^|;)\s*t=[^;]*y/i.test(published);
    add("dkim-not-testing", "dns", testing ? "warn" : "pass", testing ? "t=y" : "");
  }

  // The key is only proven good by loading it: a truncated or re-wrapped
  // record parses as base64 and still fails every verifier.
  private keyBits(record: string): number | null {
    const p = /(?:^|;)\s*p=([A-Za-z0-9+/=]+)/.exec(record)?.[1];
    if (!p) return null;
    try {
      const key = createPublicKey({ key: Buffer.from(p, "base64"), format: "der", type: "spki" });
      const size = (key.asymmetricKeyDetails?.modulusLength as number | undefined) ?? null;
      return size ?? null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------- DMARC

  private async checkDmarc(r: ReturnType<typeof resolver>, domain: string, add: Adder) {
    const records = (await txt(r, `_dmarc.${domain}`))?.filter((v) => v.toLowerCase().startsWith("v=dmarc1")) ?? [];
    if (!records.length) {
      add("dmarc-present", "dns", "fail");
      for (const id of ["dmarc-policy", "dmarc-rua"]) add(id, "dns", "skip");
      return;
    }
    const record = records[0]!;
    add("dmarc-present", "dns", "pass", record);

    const policy = /(?:^|;)\s*p=(\w+)/i.exec(record)?.[1]?.toLowerCase() ?? "none";
    add("dmarc-policy", "dns", policy === "none" ? "warn" : "pass", `p=${policy}`, { policy });

    const rua = /(?:^|;)\s*rua=([^;]+)/i.exec(record)?.[1]?.trim() ?? "";
    add("dmarc-rua", "dns", rua ? "pass" : "warn", rua);
  }

  // ------------------------------------------- MTA-STS, TLS-RPT, DANE, wildcard

  private async checkTransportRecords(r: ReturnType<typeof resolver>, domain: string, mxHost: string | null, add: Adder) {
    const sts = (await txt(r, `_mta-sts.${domain}`))?.find((v) => v.toLowerCase().startsWith("v=stsv1")) ?? null;
    if (!sts) {
      add("mta-sts", "dns", "warn");
      add("mta-sts-policy", "dns", "skip");
    } else {
      add("mta-sts", "dns", "pass", sts);
      // The TXT is only half of MTA-STS: without the served policy the record
      // announces a promise nothing keeps.
      const policy = await this.fetchStsPolicy(domain);
      add("mta-sts-policy", "dns", policy ? "pass" : "fail", policy?.slice(0, 80) ?? "not served");
    }

    const tlsrpt = (await txt(r, `_smtp._tls.${domain}`))?.find((v) => v.toLowerCase().startsWith("v=tlsrptv1")) ?? null;
    add("tls-rpt", "dns", tlsrpt ? "pass" : "warn", tlsrpt ?? "");

    if (mxHost) {
      const tlsa = await txt(r, `_25._tcp.${mxHost}`);
      // DANE without DNSSEC is decorative, so its absence is not a failure.
      add("dane", "dns", tlsa?.length ? "pass" : "skip", tlsa?.join(" ") ?? "");
    } else add("dane", "dns", "skip");

    const wildcard = await txt(r, `deliverability-probe-${Date.now().toString(36)}.${domain}`);
    add("no-wildcard-txt", "dns", wildcard?.length ? "warn" : "pass", wildcard?.join(" ") ?? "");
  }

  private fetchStsPolicy(domain: string): Promise<string | null> {
    return new Promise((resolve) => {
      const req = request(
        { host: `mta-sts.${domain}`, path: "/.well-known/mta-sts.txt", method: "GET", timeout: 5000, rejectUnauthorized: false },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            return resolve(null);
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (c: string) => (body += c.length > 4096 ? c.slice(0, 4096) : c));
          res.on("end", () => resolve(body.trim() || null));
        }
      );
      req.once("error", () => resolve(null));
      req.once("timeout", () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });
  }

  // ----------------------------------------------------------- role addresses

  // RFC 2142: some filters probe these, and a bounce on abuse@ reads as a
  // domain nobody is minding.
  private async checkRoleAddresses(domain: string, add: Adder) {
    for (const local of ["postmaster", "abuse"]) {
      const email = `${local}@${domain}`;
      const [asRecipient, asAlias] = await Promise.all([
        this.recipients.count({ where: { email } }),
        this.aliases.count({ where: { source: email } }),
      ]);
      add(`role-${local}`, "server", asRecipient + asAlias > 0 ? "pass" : "warn", email);
    }
  }

  // -------------------------------------------------------------- reputation

  private async checkReputation(r: ReturnType<typeof resolver>, ip: string, add: Adder) {
    const results = await Promise.all(BLOCKLISTS.map(async (zone) => ({ zone, ...(await dnsbl(r, ip, zone)) })));
    const listed = results.filter((v) => v.verdict === "listed");
    const answered = results.filter((v) => v.verdict !== "unavailable");
    const unavailable = results.filter((v) => v.verdict === "unavailable").map((v) => v.zone);

    if (listed.length) {
      add("blocklists", "reputation", "fail", listed.map((v) => `${v.zone} (${v.codes.join(",")})`).join(", "), {
        count: listed.length,
      });
    } else if (!answered.length) {
      // Every list refused us: reporting "clean" here would be a lie the whole
      // page would be judged on.
      add("blocklists", "reputation", "skip", unavailable.join(", "));
    } else {
      add("blocklists", "reputation", "pass", `${answered.length} lists answered`, {
        checked: answered.length,
        skipped: unavailable.length,
      });
    }

    const wl = await dnsbl(r, ip, WHITELIST);
    add(
      "dnswl",
      "reputation",
      wl.verdict === "listed" ? "pass" : "warn",
      wl.verdict === "listed" ? wl.codes.join(",") : "not listed"
    );
  }
}

type Adder = (
  id: string,
  section: CheckSection,
  status: CheckStatus,
  evidence?: string,
  params?: Record<string, string | number>
) => void;
