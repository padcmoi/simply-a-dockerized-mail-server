import { describe, it, expect, vi } from "vitest";
import { LoginRiskService } from "../../src/core/auth/mfa/login-risk.service";
import {
  APP_SETTINGS_DEFAULTS,
  type AppSettingsService,
  type AppSettingsView,
} from "../../src/core/settings/app-settings.service";
import type { GeoipService, IpLocation } from "../../src/core/geoip/geoip.service";
import type { Account } from "../../src/core/entities/account.entity";
import type { AccountAddress } from "../../src/core/entities/account-address.entity";
import type { AccountNetwork } from "../../src/core/entities/account-network.entity";
import { entity, providerMock, repoMock } from "../helpers/mocks";

const NICE: IpLocation = {
  ip: "90.116.193.236",
  latitude: 43.7031307,
  longitude: 7.2660847,
  countryCode: "FR",
  country: "France",
  region: "PACA",
  city: "Nice",
  asn: 3215,
  asnOrg: "Orange",
};
const MARSEILLE: IpLocation = { ...NICE, ip: "92.184.113.227", latitude: 43.2970463, longitude: 5.3811123, city: "Marseille" };
const PARIS: IpLocation = { ...NICE, ip: "80.12.0.1", latitude: 48.8566, longitude: 2.3522, city: "Paris" };
const OVH: IpLocation = {
  ...NICE,
  ip: "51.68.224.113",
  latitude: 50.6937,
  longitude: 3.1744,
  city: "Roubaix",
  asn: 16276,
  asnOrg: "OVH SAS",
};

const OLD = entity<Account>({ id: "a1", lastLogin: new Date("2026-09-01T00:00:00Z") });
const NEW = entity<Account>({ id: "a1", lastLogin: null });

const DAY_MS = 86_400_000;
const flush = () => new Promise((resolve) => setImmediate(resolve));

const address = (where: IpLocation, over: Partial<AccountAddress> = {}) =>
  entity<AccountAddress>({
    accountId: "a1",
    ip: where.ip,
    countryCode: where.countryCode,
    asn: where.asn,
    asnOrg: where.asnOrg,
    city: where.city,
    latitude: where.latitude.toFixed(7),
    longitude: where.longitude.toFixed(7),
    loginCount: 1,
    firstSeenAt: new Date("2026-09-01T00:00:00Z"),
    lastSeenAt: new Date("2026-09-06T00:00:00Z"),
    ...over,
  });

const network = (where: IpLocation, over: Partial<AccountNetwork> = {}) =>
  entity<AccountNetwork>({
    accountId: "a1",
    countryCode: where.countryCode,
    asn: where.asn ?? 0,
    asnOrg: where.asnOrg,
    lastCity: where.city,
    lastIp: where.ip,
    loginCount: 1,
    firstSeenAt: new Date("2026-09-01T00:00:00Z"),
    lastSeenAt: new Date("2026-09-06T00:00:00Z"),
    ...over,
  });

function makeService(over: Partial<AppSettingsView> = {}) {
  const networks = repoMock<AccountNetwork>();
  networks.find.mockResolvedValue([]);
  networks.save.mockImplementation(async (x: object) => x);
  networks.delete.mockResolvedValue({ affected: 1 });
  const addresses = repoMock<AccountAddress>();
  addresses.find.mockResolvedValue([]);
  addresses.save.mockImplementation(async (x: object) => x);
  addresses.delete.mockResolvedValue({ affected: 1 });
  const geoip = providerMock<GeoipService>({ locationOf: vi.fn(async () => null) });
  const settings = providerMock<AppSettingsService>({ get: vi.fn(() => ({ ...APP_SETTINGS_DEFAULTS, ...over })) });
  return { networks, addresses, geoip, settings, svc: new LoginRiskService(networks, addresses, geoip, settings) };
}

describe("LoginRiskService.locate", () => {
  it("asks the provider for an address it was given", async () => {
    const { svc, geoip } = makeService();
    geoip.locationOf.mockResolvedValue(NICE);
    expect(await svc.locate("90.116.193.236")).toEqual(NICE);
    expect(geoip.locationOf).toHaveBeenCalledWith("90.116.193.236");
  });

  it("asks nothing when there is no address at all", async () => {
    const { svc, geoip } = makeService();
    expect(await svc.locate(undefined)).toBeNull();
    expect(geoip.locationOf).not.toHaveBeenCalled();
  });
});

describe("LoginRiskService.assess", () => {
  it("poses the memory silently on the first sign-in of an account", async () => {
    const { svc } = makeService();
    expect(await svc.assess(NEW, PARIS)).toEqual({ far: false, unknownNetwork: false, expired: false, suspicious: null });
  });

  it("measures a known address against its own record, so a proof given once holds", async () => {
    const { svc, addresses, networks } = makeService();
    addresses.find.mockResolvedValue([address(NICE), address(MARSEILLE)]);
    networks.find.mockResolvedValue([network(NICE)]);
    expect((await svc.assess(OLD, NICE)).suspicious).toBeNull();
    expect((await svc.assess(OLD, MARSEILLE)).suspicious).toBeNull();
  });

  it("measures an unknown address against the nearest known one", async () => {
    const { svc, addresses, networks } = makeService();
    addresses.find.mockResolvedValue([address(NICE), address(MARSEILLE)]);
    networks.find.mockResolvedValue([network(NICE)]);
    const res = await svc.assess(OLD, PARIS);
    expect(res.far).toBe(true);
    expect(res.suspicious).toMatchObject({ thresholdKm: 100, reasons: ["distance"], city: "Paris", asn: 3215 });
    expect(res.suspicious?.distanceKm).toBeGreaterThan(600);
    expect(res.suspicious?.distanceKm).toBeLessThan(700);
  });

  it("fires on a known address whose record was altered", async () => {
    const { svc, addresses, networks } = makeService();
    addresses.find.mockResolvedValue([address(NICE, { latitude: "48.8566000", longitude: "2.3522000" })]);
    networks.find.mockResolvedValue([network(NICE)]);
    expect((await svc.assess(OLD, NICE)).suspicious).toMatchObject({ reasons: ["distance"] });
  });

  it("fires on an operator the account has never used, whatever the distance", async () => {
    const { svc, addresses, networks } = makeService();
    addresses.find.mockResolvedValue([address(NICE)]);
    networks.find.mockResolvedValue([network(NICE)]);
    const res = await svc.assess(OLD, { ...NICE, ip: "1.2.3.4", asn: 12322, asnOrg: "Free" });
    expect(res).toMatchObject({ far: false, unknownNetwork: true, expired: false });
    expect(res.suspicious?.reasons).toEqual(["network"]);
  });

  it("cumulates the distance and the operator", async () => {
    const { svc, addresses, networks } = makeService();
    addresses.find.mockResolvedValue([address(NICE)]);
    networks.find.mockResolvedValue([network(NICE)]);
    expect((await svc.assess(OLD, OVH)).suspicious?.reasons).toEqual(["distance", "network"]);
  });

  it("stops looking at the distance at radius zero, and keeps the operator", async () => {
    const { svc, addresses, networks } = makeService({ loginRadiusKm: 0 });
    addresses.find.mockResolvedValue([address(NICE)]);
    networks.find.mockResolvedValue([network(NICE)]);
    expect((await svc.assess(OLD, PARIS)).suspicious).toBeNull();
    expect((await svc.assess(OLD, OVH)).suspicious?.reasons).toEqual(["network"]);
  });

  it("fires on an account that signed in before but remembers nothing live any more", async () => {
    const { svc } = makeService();
    const res = await svc.assess(OLD, NICE);
    expect(res).toMatchObject({ far: false, unknownNetwork: false, expired: true });
    expect(res.suspicious?.reasons).toEqual(["expired"]);
  });

  it("fires when the operators expired while an address is still known", async () => {
    const { svc, addresses } = makeService();
    addresses.find.mockResolvedValue([address(NICE)]);
    expect((await svc.assess(OLD, NICE)).suspicious?.reasons).toEqual(["expired"]);
  });

  it("reads only the rows still inside their own window", async () => {
    const { svc, addresses, networks } = makeService({ loginAddressDays: 30, loginNetworkDays: 180 });
    await svc.assess(OLD, NICE);
    const since = (call: unknown) => (call as { where: { lastSeenAt: { value: Date } } }).where.lastSeenAt.value;
    expect(Date.now() - since(addresses.find.mock.calls[0]?.[0]).getTime()).toBeCloseTo(30 * DAY_MS, -4);
    expect(Date.now() - since(networks.find.mock.calls[0]?.[0]).getTime()).toBeCloseTo(180 * DAY_MS, -4);
  });

  it("is quiet when the address could not be placed", async () => {
    const { svc, addresses } = makeService();
    expect(await svc.assess(OLD, null)).toEqual({ far: false, unknownNetwork: false, expired: false, suspicious: null });
    expect(addresses.find).not.toHaveBeenCalled();
  });

  it("carries a debug block naming the reference in development only", async () => {
    const before = process.env.NODE_ENV;
    const { svc, addresses, networks } = makeService();
    addresses.find.mockResolvedValue([address(NICE), address(MARSEILLE)]);
    networks.find.mockResolvedValue([network(NICE)]);
    try {
      process.env.NODE_ENV = "development";
      expect((await svc.assess(OLD, PARIS)).suspicious?.debug).toMatchObject({
        reasons: ["distance"],
        from: { kind: "nearest", ip: MARSEILLE.ip, city: "Marseille" },
        to: { city: "Paris", asn: 3215 },
      });
      process.env.NODE_ENV = "test";
      expect((await svc.assess(OLD, PARIS)).suspicious?.debug).toBeUndefined();
    } finally {
      process.env.NODE_ENV = before;
    }
  });
});

describe("LoginRiskService.remember", () => {
  it("writes the operator and the address of a session that opened", async () => {
    const { svc, networks, addresses } = makeService();
    await svc.remember("a1", NICE, "90.116.193.236");
    expect(networks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "a1",
        countryCode: "FR",
        asn: 3215,
        asnOrg: "Orange",
        lastIp: "90.116.193.236",
        loginCount: 1,
      })
    );
    expect(addresses.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "a1",
        ip: NICE.ip,
        latitude: "43.7031307",
        longitude: "7.2660847",
        city: "Nice",
        asn: 3215,
        loginCount: 1,
      })
    );
  });

  it("counts a session on a row that already exists and moves its coordinates", async () => {
    const { svc, networks, addresses } = makeService();
    addresses.findOne.mockResolvedValue(address(NICE, { loginCount: 4 }));
    networks.findOne.mockResolvedValue(network(NICE));
    await svc.remember("a1", { ...NICE, latitude: 43.71 }, NICE.ip);
    expect(addresses.save).toHaveBeenCalledWith(expect.objectContaining({ loginCount: 5, latitude: "43.7100000" }));
    expect(networks.save).toHaveBeenCalledWith(expect.objectContaining({ loginCount: 2 }));
  });

  it("writes nothing when the address could not be placed", async () => {
    const { svc, networks, addresses } = makeService();
    await svc.remember("a1", null, "10.0.0.1");
    expect(networks.save).not.toHaveBeenCalled();
    expect(addresses.save).not.toHaveBeenCalled();
  });

  it("swallows a write that fails: the memory is a convenience, not a credential", async () => {
    const { svc, networks, addresses } = makeService();
    networks.save.mockRejectedValue(new Error("disk full"));
    addresses.save.mockRejectedValue(new Error("disk full"));
    await expect(svc.remember("a1", NICE, NICE.ip)).resolves.toBeUndefined();
  });

  it("prunes what expired, once a day at most", async () => {
    const { svc, networks, addresses } = makeService();
    await svc.remember("a1", NICE, NICE.ip);
    await svc.remember("a1", NICE, NICE.ip);
    await flush();
    expect(addresses.delete).toHaveBeenCalledTimes(1);
    expect(networks.delete).toHaveBeenCalledTimes(1);
  });
});

describe("LoginRiskService.listFor and forget", () => {
  it("lists the live operators with their addresses and the date each is forgotten", async () => {
    const { svc, networks, addresses } = makeService();
    networks.find.mockResolvedValue([network(NICE)]);
    addresses.find.mockResolvedValue([address(NICE), address(MARSEILLE, { lastSeenAt: new Date("2026-09-07T00:00:00Z") })]);
    const [row] = await svc.listFor("a1");
    expect(row).toMatchObject({ countryCode: "FR", asn: 3215, asnOrg: "Orange", lastIp: NICE.ip });
    expect(row?.addresses.map((a) => a.ip)).toEqual([MARSEILLE.ip, NICE.ip]);
    expect(row!.expiresAt.getTime() - row!.lastSeenAt.getTime()).toBe(180 * DAY_MS);
    expect(row!.addresses[0]!.expiresAt.getTime() - row!.addresses[0]!.lastSeenAt.getTime()).toBe(30 * DAY_MS);
  });

  it("forgets an operator and its addresses together", async () => {
    const { svc, networks, addresses } = makeService();
    expect(await svc.forget("a1", "FR", 3215)).toEqual({ forgotten: true });
    expect(networks.delete).toHaveBeenCalledWith({ accountId: "a1", countryCode: "FR", asn: 3215 });
    expect(addresses.delete).toHaveBeenCalledWith({ accountId: "a1", countryCode: "FR", asn: 3215 });
  });
});
