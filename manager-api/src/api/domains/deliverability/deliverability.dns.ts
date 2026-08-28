import { Resolver } from "node:dns/promises";

// Every lookup goes through one short-timeout resolver: a diagnostic page that
// hangs on a dead nameserver is worse than one that says "no answer".
const TIMEOUT_MS = 4000;

export function resolver(): Resolver {
  const r = new Resolver({ timeout: TIMEOUT_MS, tries: 2 });
  return r;
}

export async function attempt<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch {
    return null;
  }
}

// TXT records arrive as arrays of chunks (a record longer than 255 bytes is
// split at the protocol level); joining them back is what makes a 2048 bit
// DKIM key readable.
export async function txt(r: Resolver, name: string): Promise<string[] | null> {
  const rows = await attempt(r.resolveTxt(name));
  return rows ? rows.map((chunks) => chunks.join("")) : null;
}

export async function a(r: Resolver, name: string): Promise<string[] | null> {
  return attempt(r.resolve4(name));
}

export async function aaaa(r: Resolver, name: string): Promise<string[] | null> {
  return attempt(r.resolve6(name));
}

export async function ptr(r: Resolver, ip: string): Promise<string[] | null> {
  return attempt(r.reverse(ip));
}

export async function mx(r: Resolver, name: string): Promise<{ exchange: string; priority: number }[] | null> {
  return attempt(r.resolveMx(name));
}

export async function cname(r: Resolver, name: string): Promise<string[] | null> {
  return attempt(r.resolveCname(name));
}

// The reversed dotted form a DNSBL is queried on: 1.2.3.4 -> 4.3.2.1.
export function reverseIp(ip: string): string {
  return ip.split(".").reverse().join(".");
}

// A DNSBL answers 127.0.0.x for "listed" and NXDOMAIN for "clean". Anything
// else - a timeout, a refusal, 127.255.255.x - means the list did not answer
// us, which is NOT the same as clean and must never be reported as such:
// Spamhaus and others refuse queries coming from public resolvers, and a
// diagnostic that turns that refusal into a green tick would be lying.
export type DnsblVerdict = "listed" | "clean" | "unavailable";

// The two lookups a verdict is read from, and nothing more. A `Resolver`
// satisfies this, so callers pass one unchanged; a test satisfies it with two
// functions instead of standing in for a class whose overloads it never uses.
export interface DnsQuery {
  resolve4(name: string): Promise<string[]>;
  resolveTxt(name: string): Promise<string[][]>;
}

export async function dnsbl(r: DnsQuery, ip: string, zone: string): Promise<{ verdict: DnsblVerdict; codes: string[] }> {
  try {
    const answers = await r.resolve4(`${reverseIp(ip)}.${zone}`);
    const refused = answers.some((code) => code.startsWith("127.255.255."));
    return { verdict: refused ? "unavailable" : "listed", codes: answers };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return { verdict: "clean", codes: [] };
    return { verdict: "unavailable", codes: [] };
  }
}

// The authoritative nameservers of a zone, so a node's rcode can be asked
// where it is authoritative rather than through a cache.
export async function authoritativeResolver(domain: string): Promise<Resolver | null> {
  const r = resolver();
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i += 1) {
    const zone = labels.slice(i).join(".");
    const ns = await attempt(r.resolveNs(zone));
    if (!ns?.length) continue;
    const addresses = (await Promise.all(ns.slice(0, 3).map((host) => a(r, host)))).flat().filter((v): v is string => Boolean(v));
    if (!addresses.length) continue;
    const authoritative = resolver();
    authoritative.setServers(addresses);
    return authoritative;
  }
  return null;
}

// NOERROR on a name that holds no record of its own is what says "something
// exists below this node" - the only honest way to ask whether a domain has
// ANY dkim selector without guessing selector names.
export type NodeState = "exists" | "empty" | "unknown";

export async function nodeState(r: DnsQuery, name: string): Promise<NodeState> {
  try {
    await r.resolveTxt(name);
    return "exists";
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENODATA") return "exists";
    if (code === "ENOTFOUND") return "empty";
    return "unknown";
  }
}
