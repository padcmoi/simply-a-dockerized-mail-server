import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, MoreThanOrEqual, Repository } from "typeorm";
import { GeoPoint, haversineKm } from "../../common/haversine";
import { Account } from "../../entities/account.entity";
import { AccountAddress } from "../../entities/account-address.entity";
import { AccountNetwork } from "../../entities/account-network.entity";
import { GeoipService, IpLocation } from "../../geoip/geoip.service";
import { AppSettingsService } from "../../settings/app-settings.service";

export type SuspicionReason = "distance" | "network" | "expired";
export type ReferenceKind = "address" | "nearest";

export interface Reference extends GeoPoint {
  kind: ReferenceKind;
  ip: string;
  city: string;
}

export interface LoginRiskDebug {
  distanceKm: number | null;
  thresholdKm: number;
  reasons: SuspicionReason[];
  from: Reference | null;
  to: { city: string; countryCode: string; latitude: number; longitude: number; asn: number | null; asnOrg: string } | null;
}

export interface FarAway {
  distanceKm: number | null;
  thresholdKm: number;
  countryCode: string;
  asn: number | null;
  asnOrg: string;
  city: string;
  reasons: SuspicionReason[];
  debug?: LoginRiskDebug;
}

export interface RiskAssessment {
  far: boolean;
  unknownNetwork: boolean;
  expired: boolean;
  suspicious: FarAway | null;
}

export interface KnownAddress {
  ip: string;
  city: string;
  loginCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

const DAY_MS = 24 * 3_600_000;

function hasNetwork(where: IpLocation | null): where is IpLocation & { asn: number } {
  return !!where && where.countryCode.length === 2 && typeof where.asn === "number" && where.asn > 0;
}

function pointOf(row: AccountAddress): GeoPoint {
  return { latitude: Number(row.latitude), longitude: Number(row.longitude) };
}

function nearestOf(rows: AccountAddress[], where: GeoPoint): AccountAddress | null {
  let best: AccountAddress | null = null;
  let bestKm = Infinity;
  for (const row of rows) {
    const km = haversineKm(pointOf(row), where);
    if (km < bestKm) {
      best = row;
      bestKm = km;
    }
  }
  return best;
}

@Injectable()
export class LoginRiskService {
  private prunedAt = 0;

  constructor(
    @InjectRepository(AccountNetwork) private readonly networks: Repository<AccountNetwork>,
    @InjectRepository(AccountAddress) private readonly addresses: Repository<AccountAddress>,
    private readonly geoip: GeoipService,
    private readonly settings: AppSettingsService
  ) {}

  locate(ip?: string): Promise<IpLocation | null> {
    return ip ? this.geoip.locationOf(ip) : Promise.resolve(null);
  }

  private sinceAddresses() {
    return new Date(Date.now() - this.settings.get().loginAddressDays * DAY_MS);
  }

  private sinceNetworks() {
    return new Date(Date.now() - this.settings.get().loginNetworkDays * DAY_MS);
  }

  private knownAddresses(accountId: string): Promise<AccountAddress[]> {
    return this.addresses.find({ where: { accountId, lastSeenAt: MoreThanOrEqual(this.sinceAddresses()) } }).catch(() => []);
  }

  private knownNetworks(accountId: string): Promise<AccountNetwork[]> {
    return this.networks
      .find({ where: { accountId, lastSeenAt: MoreThanOrEqual(this.sinceNetworks()) }, order: { lastSeenAt: "DESC" } })
      .catch(() => []);
  }

  private referenceOf(known: AccountAddress[], where: IpLocation): Reference | null {
    const own = known.find((row) => row.ip === where.ip);
    const row = own ?? nearestOf(known, where);
    if (!row) return null;
    return { kind: own ? "address" : "nearest", ip: row.ip, city: row.city ?? "", ...pointOf(row) };
  }

  async assess(account: Account, where: IpLocation | null): Promise<RiskAssessment> {
    const radiusKm = this.settings.get().loginRadiusKm;
    const [addresses, networks] = where
      ? await Promise.all([this.knownAddresses(account.id), this.knownNetworks(account.id)])
      : [[], []];
    const reference = where ? this.referenceOf(addresses, where) : null;
    const distanceKm = where && reference ? Math.round(haversineKm(reference, where)) : null;
    const far = radiusKm > 0 && distanceKm !== null && distanceKm > radiusKm;
    const unknownNetwork =
      hasNetwork(where) &&
      networks.length > 0 &&
      !networks.some((row) => row.countryCode === where.countryCode && row.asn === where.asn);
    const expired = !!where && account.lastLogin !== null && (addresses.length === 0 || networks.length === 0);
    if (!far && !unknownNetwork && !expired) return { far, unknownNetwork, expired, suspicious: null };
    const reasons: SuspicionReason[] = [];
    if (far) reasons.push("distance");
    if (unknownNetwork) reasons.push("network");
    if (expired) reasons.push("expired");
    return {
      far,
      unknownNetwork,
      expired,
      suspicious: {
        distanceKm,
        thresholdKm: radiusKm,
        countryCode: where?.countryCode ?? "",
        asn: where?.asn ?? null,
        asnOrg: where?.asnOrg ?? "",
        city: where?.city ?? "",
        reasons,
        debug: this.debugOf(distanceKm, radiusKm, reasons, reference, where),
      },
    };
  }

  private debugOf(
    distanceKm: number | null,
    thresholdKm: number,
    reasons: SuspicionReason[],
    reference: Reference | null,
    where: IpLocation | null
  ): LoginRiskDebug | undefined {
    if (process.env.NODE_ENV !== "development") return undefined;
    return {
      distanceKm,
      thresholdKm,
      reasons,
      from: reference,
      to: where
        ? {
            city: where.city,
            countryCode: where.countryCode,
            latitude: where.latitude,
            longitude: where.longitude,
            asn: where.asn,
            asnOrg: where.asnOrg,
          }
        : null,
    };
  }

  async remember(accountId: string, where: IpLocation | null, ip?: string) {
    await this.rememberNetwork(accountId, where, ip);
    await this.rememberAddress(accountId, where);
    void this.pruneOncePerDay();
  }

  private async rememberNetwork(accountId: string, where: IpLocation | null, ip?: string) {
    if (!hasNetwork(where)) return;
    try {
      const row =
        (await this.networks.findOne({ where: { accountId, countryCode: where.countryCode, asn: where.asn } })) ??
        this.networks.create({ accountId, countryCode: where.countryCode, asn: where.asn, loginCount: 0 });
      row.asnOrg = where.asnOrg || row.asnOrg;
      row.lastCity = where.city || row.lastCity;
      row.lastIp = ip ?? row.lastIp;
      row.loginCount = (row.loginCount ?? 0) + 1;
      row.lastSeenAt = new Date();
      await this.networks.save(row);
    } catch {
      /* empty */
    }
  }

  private async rememberAddress(accountId: string, where: IpLocation | null) {
    if (!where) return;
    try {
      const row =
        (await this.addresses.findOne({ where: { accountId, ip: where.ip } })) ??
        this.addresses.create({ accountId, ip: where.ip, loginCount: 0 });
      row.countryCode = where.countryCode.length === 2 ? where.countryCode : null;
      row.asn = hasNetwork(where) ? where.asn : null;
      row.asnOrg = where.asnOrg || null;
      row.city = where.city?.slice(0, 64) || null;
      row.latitude = where.latitude.toFixed(7);
      row.longitude = where.longitude.toFixed(7);
      row.loginCount = (row.loginCount ?? 0) + 1;
      row.lastSeenAt = new Date();
      await this.addresses.save(row);
    } catch {
      /* empty */
    }
  }

  private async pruneOncePerDay() {
    if (Date.now() - this.prunedAt < DAY_MS) return;
    this.prunedAt = Date.now();
    await this.addresses.delete({ lastSeenAt: LessThan(this.sinceAddresses()) }).catch(() => undefined);
    await this.networks.delete({ lastSeenAt: LessThan(this.sinceNetworks()) }).catch(() => undefined);
  }

  async listFor(accountId: string) {
    const [rows, known] = await Promise.all([this.knownNetworks(accountId), this.knownAddresses(accountId)]);
    const { loginAddressDays, loginNetworkDays } = this.settings.get();
    return rows.map((row) => ({
      countryCode: row.countryCode,
      asn: row.asn,
      asnOrg: row.asnOrg ?? "",
      lastCity: row.lastCity ?? "",
      lastIp: row.lastIp ?? "",
      loginCount: row.loginCount,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: new Date(row.lastSeenAt.getTime() + loginNetworkDays * DAY_MS),
      addresses: known
        .filter((a) => a.countryCode === row.countryCode && a.asn === row.asn)
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
        .map((a): KnownAddress => ({
          ip: a.ip,
          city: a.city ?? "",
          loginCount: a.loginCount,
          firstSeenAt: a.firstSeenAt,
          lastSeenAt: a.lastSeenAt,
          expiresAt: new Date(a.lastSeenAt.getTime() + loginAddressDays * DAY_MS),
        })),
    }));
  }

  async forget(accountId: string, countryCode: string, asn: number) {
    const result = await this.networks.delete({ accountId, countryCode, asn });
    await this.addresses.delete({ accountId, countryCode, asn }).catch(() => undefined);
    return { forgotten: (result.affected ?? 0) > 0 };
  }
}
