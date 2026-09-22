import { Injectable } from "@nestjs/common";
import { promises as dns } from "dns";

function ipNumber(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((sum, part) => sum * 256 + part, 0);
}

export function ipv4InRange(ip: string, range: string): boolean {
  const [base = "", bits = "32"] = range.split("/");
  const prefix = Number(bits);
  const address = ipNumber(ip);
  const network = ipNumber(base);
  if (address === null || network === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const size = 2 ** (32 - prefix);
  return Math.floor(address / size) === Math.floor(network / size);
}

export function spfTerms(record: string): string[] {
  return record.trim().split(/\s+/).slice(1);
}

function passing(term: string): string | null {
  if (term.startsWith("-") || term.startsWith("~") || term.startsWith("?")) return null;
  return term.replace(/^\+/, "").toLowerCase();
}

export function recommendedSpfRecord(published: string | null, ips: string[]): string {
  const ours = ["mx", ...ips.map((ip) => `ip4:${ip}`)];
  if (!published) return ["v=spf1", ...ours, "-all"].join(" ");
  const terms = spfTerms(published);
  const bare = (term: string) => term.replace(/^[+~?-]/, "").toLowerCase();
  const ending = terms.find((term) => bare(term) === "all") ?? terms.find((term) => bare(term).startsWith("redirect=")) ?? "-all";
  const kept = terms.filter((term) => {
    const name = bare(term);
    if (name === "all" || name.startsWith("redirect=")) return false;
    if (name === "mx" || name.startsWith("mx/")) return false;
    return ips.length === 0 || !/^ip[46]:/.test(name);
  });
  return ["v=spf1", ...ours, ...kept.filter((term) => !ours.includes(bare(term))), ending].join(" ");
}

@Injectable()
export class SpfRecordService {
  async txt(name: string): Promise<{ records: string[]; error: string | null }> {
    try {
      const records = (await dns.resolveTxt(name)).map((chunks) => chunks.join("").trim());
      return { records: records.filter((record) => /^v=spf1(\s|$)/i.test(record)), error: null };
    } catch (e) {
      return { records: [], error: (e as NodeJS.ErrnoException).code ?? (e as Error).message };
    }
  }

  async addresses(host: string): Promise<string[]> {
    return dns.resolve4(host).catch(() => [] as string[]);
  }

  async exchanges(domain: string): Promise<string[]> {
    const hosts = await dns.resolveMx(domain).catch(() => [] as { exchange: string }[]);
    return (await Promise.all(hosts.map((host) => this.addresses(host.exchange)))).flat();
  }

  async authorizes(domain: string, record: string, ip: string): Promise<boolean> {
    for (const raw of spfTerms(record)) {
      const term = passing(raw);
      if (!term) continue;
      const [mechanism = "", target = ""] = term.split(/:(.*)/s);
      const host = target.replace(/\/\d+$/, "") || domain;
      const name = mechanism.replace(/\/\d+$/, "");
      if (name === "ip4" && ipv4InRange(ip, target)) return true;
      if (name === "a" && (await this.addresses(host)).includes(ip)) return true;
      if (name === "mx" && (await this.exchanges(host)).includes(ip)) return true;
    }
    return false;
  }

  async describe(domain: string) {
    const name = domain.toLowerCase();
    const mailHost = (process.env.MAIL_HOSTNAME ?? "").toLowerCase();
    const [{ records, error }, ips] = await Promise.all([this.txt(name), mailHost ? this.addresses(mailHost) : []]);
    const published = records[0] ?? null;
    const covered =
      published !== null &&
      ips.length > 0 &&
      (await Promise.all(ips.map((ip) => this.authorizes(name, published, ip)))).every(Boolean);
    return {
      dnsName: name,
      txtRecord: recommendedSpfRecord(published, ips),
      mailHost,
      ips,
      published,
      multiple: records.length > 1,
      covered,
      error,
    };
  }
}
