import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { GeoipCache } from "../entities/geoip-cache.entity";
import { AppSettingsService } from "../settings/app-settings.service";

export interface IpLocation {
  ip: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  country: string;
  region: string;
  city: string;
  asn: number | null;
  asnOrg: string;
}

const DEFAULT_URL = "https://ipwho.is/{ip}";
const TIMEOUT_MS = 2000;
const NEGATIVE_TTL_MS = 24 * 3_600_000;
const RATE_LIMIT_PAUSE_MS = 6 * 3_600_000;
const UNREAD_MAX_DAYS = 365;
const PRUNE_EVERY_MS = 24 * 3_600_000;

const RESERVED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
];

function toLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (part.trim() === "" || !Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

export function normaliseIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  return /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(trimmed)?.[1] ?? trimmed;
}

function isReservedV6(ip: string) {
  if (ip === "::" || ip === "::1") return true;
  const head = ip.split(":")[0] ?? "";
  return /^f[cd]/.test(head) || /^fe[89ab]/.test(head);
}

export function isReservedIp(ip: string): boolean {
  const address = normaliseIp(ip);
  if (address.length === 0) return true;
  const value = toLong(address);
  if (value === null) return address.includes(":") ? isReservedV6(address) : true;
  return RESERVED_V4.some(([base, bits]) => {
    const start = toLong(base);
    if (start === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (start & mask) >>> 0;
  });
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function asnFromText(value: unknown): number | null {
  const match = /^AS(\d+)/i.exec(String(value ?? "").trim());
  return match ? Number(match[1]) : null;
}

function text(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

@Injectable()
export class GeoipService {
  private readonly log = new Logger(GeoipService.name);
  private blockedUntil = 0;
  private prunedAt = 0;
  private readonly inFlight = new Map<string, Promise<IpLocation | null>>();

  constructor(
    @InjectRepository(GeoipCache) private readonly cache: Repository<GeoipCache>,
    private readonly settings: AppSettingsService
  ) {}

  async locationOf(ip?: string | null): Promise<IpLocation | null> {
    if (typeof ip !== "string") return null;
    const address = normaliseIp(ip);
    if (address.length === 0 || isReservedIp(address)) return null;

    void this.pruneOncePerDay();
    const row = await this.cache.findOne({ where: { ip: address } }).catch(() => null);
    if (row && row.expiresAt.getTime() > Date.now()) {
      void this.touch(address);
      return this.toLocation(row);
    }

    const running = this.inFlight.get(address);
    if (running) return running;
    const pending = this.resolve(address, row).finally(() => this.inFlight.delete(address));
    this.inFlight.set(address, pending);
    return pending;
  }

  async countryOf(ip?: string | null): Promise<string> {
    return (await this.locationOf(ip))?.countryCode ?? "";
  }

  async countriesFor(ips: string[]): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    for (const ip of new Set(ips)) {
      found.set(ip, await this.countryOf(ip));
    }
    return found;
  }

  async prune() {
    const limit = new Date(Date.now() - UNREAD_MAX_DAYS * 24 * 3_600_000);
    await this.cache.delete({ lastReadAt: LessThan(limit) }).catch(() => undefined);
  }

  private async pruneOncePerDay() {
    if (Date.now() - this.prunedAt < PRUNE_EVERY_MS) return;
    this.prunedAt = Date.now();
    await this.prune();
  }

  private toLocation(row: GeoipCache): IpLocation | null {
    if (!row.resolved) return null;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      ip: row.ip,
      latitude,
      longitude,
      countryCode: row.countryCode ?? "",
      country: row.country ?? "",
      region: row.region ?? "",
      city: row.city ?? "",
      asn: row.asn,
      asnOrg: row.asnOrg ?? "",
    };
  }

  private touch(ip: string) {
    return this.cache.update({ ip }, { lastReadAt: new Date() }).catch(() => undefined);
  }

  private async resolve(ip: string, stale: GeoipCache | null): Promise<IpLocation | null> {
    const fallback = stale ? this.toLocation(stale) : null;
    if (Date.now() < this.blockedUntil) return fallback;

    const fetched = await this.ask(ip);
    if (fetched === undefined) return fallback;

    const days = Math.max(1, this.settings.get().geoipCacheDays);
    await this.store(ip, fetched, fetched ? days * 24 * 3_600_000 : NEGATIVE_TTL_MS);
    return fetched;
  }

  private async store(ip: string, info: IpLocation | null, ttlMs: number) {
    const now = new Date();
    await this.cache
      .upsert(
        {
          ip,
          resolved: info ? 1 : 0,
          countryCode: info?.countryCode || null,
          country: info?.country || null,
          region: info?.region || null,
          city: info?.city || null,
          latitude: info ? info.latitude.toFixed(7) : null,
          longitude: info ? info.longitude.toFixed(7) : null,
          asn: info?.asn ?? null,
          asnOrg: info?.asnOrg || null,
          provider: this.providerName(),
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + ttlMs),
          lastReadAt: now,
        },
        ["ip"]
      )
      .catch(() => undefined);
  }

  private providerName() {
    try {
      return new URL(this.url("0.0.0.0")).hostname.slice(0, 32);
    } catch {
      return "unknown";
    }
  }

  private url(ip: string) {
    const template = process.env.GEOIP_URL || DEFAULT_URL;
    return template.replace("{ip}", encodeURIComponent(ip)).replace("{token}", process.env.GEOIP_TOKEN ?? "");
  }

  private async ask(ip: string): Promise<IpLocation | null | undefined> {
    try {
      const response = await fetch(this.url(ip), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const pause = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_PAUSE_MS;
        this.blockedUntil = Date.now() + pause;
        this.log.warn(`Geoip provider is rate limiting, no lookup for ${Math.round(pause / 60000)} minutes`);
        return undefined;
      }
      if (!response.ok) return null;
      return this.read(ip, (await response.json()) as Record<string, unknown>);
    } catch (e) {
      this.log.warn(`Geoip lookup of ${ip} failed: ${(e as Error).message}`);
      return undefined;
    }
  }

  private read(ip: string, body: Record<string, unknown>): IpLocation | null {
    if (body.success === false || body.error) return null;
    const connection = (body.connection ?? {}) as Record<string, unknown>;
    const loc = text(body.loc, 64).split(",");
    const latitude = Number(body.latitude ?? body.lat ?? loc[0]);
    const longitude = Number(body.longitude ?? body.lon ?? loc[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const countryCode = text(body.country_code ?? body.countryCode, 2).toUpperCase();
    const asn = asNumber(connection.asn ?? body.asn) ?? asnFromText(body.as ?? body.asn ?? body.org);

    return {
      ip,
      latitude,
      longitude,
      countryCode: countryCode.length === 2 ? countryCode : "",
      country: text(body.country, 64),
      region: text(body.region ?? body.regionName ?? body.region_name, 64),
      city: text(body.city, 64),
      asn,
      asnOrg: text(connection.org ?? connection.isp ?? body.isp ?? body.org ?? body.as, 128),
    };
  }
}
