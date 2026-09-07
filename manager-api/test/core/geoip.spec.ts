import { describe, it, expect, afterEach, vi } from "vitest";
import { GeoipService, isReservedIp, normaliseIp } from "../../src/core/geoip/geoip.service";
import { APP_SETTINGS_DEFAULTS, type AppSettingsService } from "../../src/core/settings/app-settings.service";
import type { GeoipCache } from "../../src/core/entities/geoip-cache.entity";
import { entity, providerMock, repoMock } from "../helpers/mocks";

const DAY_MS = 86_400_000;

const IPWHO = {
  ip: "8.8.8.8",
  success: true,
  country: "United States",
  country_code: "US",
  region: "California",
  city: "Mountain View",
  latitude: 37.386,
  longitude: -122.0838,
  connection: { asn: 15169, org: "Google LLC" },
};

const row = (over: Partial<GeoipCache> = {}) =>
  entity<GeoipCache>({
    ip: "8.8.8.8",
    resolved: 1,
    countryCode: "US",
    country: "United States",
    region: "California",
    city: "Mountain View",
    latitude: "37.3860000",
    longitude: "-122.0838000",
    asn: 15169,
    asnOrg: "Google LLC",
    provider: "ipwho.is",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + DAY_MS),
    lastReadAt: new Date(),
    ...over,
  });

function makeService() {
  const cache = repoMock<GeoipCache>();
  cache.findOne.mockResolvedValue(null);
  cache.upsert.mockResolvedValue(undefined);
  cache.update.mockResolvedValue(undefined);
  cache.delete.mockResolvedValue(undefined);
  const settings = providerMock<AppSettingsService>({ get: vi.fn(() => APP_SETTINGS_DEFAULTS) });
  return { cache, svc: new GeoipService(cache, settings) };
}

const answer = (body: unknown, init: ResponseInit = {}) =>
  vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init })
  );

afterEach(() => vi.unstubAllGlobals());

describe("normaliseIp", () => {
  it("brings an IPv4 address in its mapped IPv6 form back to four octets", () => {
    expect(normaliseIp("::ffff:8.8.8.8")).toBe("8.8.8.8");
  });

  it("trims and lower-cases what it is given", () => {
    expect(normaliseIp(" 2001:DB8::1 ")).toBe("2001:db8::1");
  });
});

describe("isReservedIp", () => {
  it("keeps every private, loopback, link-local and unreadable address on the server", () => {
    const reserved = ["127.0.0.1", "::1", "10.1.2.3", "172.28.0.5", "192.168.1.10", "169.254.0.1", "fe80::1", "fc00::1"];
    for (const address of [...reserved, "", "not-an-ip", "999.1.1.1", "1.2.3"]) {
      expect(isReservedIp(address), address).toBe(true);
    }
  });

  it("lets a public address out, in either family", () => {
    for (const address of ["8.8.8.8", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
      expect(isReservedIp(address), address).toBe(false);
    }
  });
});

describe("GeoipService.locationOf", () => {
  it("serves a fresh row from the table without leaving the server", async () => {
    const fetch = answer(IPWHO);
    vi.stubGlobal("fetch", fetch);
    const { svc, cache } = makeService();
    cache.findOne.mockResolvedValue(row());
    expect(await svc.locationOf("::ffff:8.8.8.8")).toMatchObject({
      ip: "8.8.8.8",
      countryCode: "US",
      city: "Mountain View",
      asn: 15169,
      latitude: 37.386,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(cache.update).toHaveBeenCalledWith({ ip: "8.8.8.8" }, expect.objectContaining({ lastReadAt: expect.any(Date) }));
  });

  it("places nothing on a reserved address and never asks the table for it", async () => {
    const { svc, cache } = makeService();
    for (const address of ["127.0.0.1", "10.1.2.3", "172.28.0.5", "192.168.1.10", "", "not-an-ip", "1.2.3"]) {
      expect(await svc.locationOf(address)).toBeNull();
    }
    expect(cache.findOne).not.toHaveBeenCalled();
  });

  it("asks the provider once for an address it does not know, and keeps the answer for the cache duration", async () => {
    const fetch = answer(IPWHO);
    vi.stubGlobal("fetch", fetch);
    const { svc, cache } = makeService();
    expect(await svc.locationOf("8.8.8.8")).toMatchObject({
      countryCode: "US",
      asn: 15169,
      asnOrg: "Google LLC",
      city: "Mountain View",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("8.8.8.8");
    const stored = cache.upsert.mock.calls[0]?.[0] as { expiresAt: Date; fetchedAt: Date };
    expect(stored).toMatchObject({ resolved: 1, countryCode: "US", asn: 15169 });
    expect(stored.expiresAt.getTime() - stored.fetchedAt.getTime()).toBe(APP_SETTINGS_DEFAULTS.geoipCacheDays * DAY_MS);
  });

  it("makes two simultaneous demands for one address a single call", async () => {
    const fetch = answer(IPWHO);
    vi.stubGlobal("fetch", fetch);
    const { svc } = makeService();
    await Promise.all([svc.locationOf("8.8.8.8"), svc.locationOf("8.8.8.8")]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps a negative answer a day only", async () => {
    vi.stubGlobal("fetch", answer({ success: false, message: "Reserved range" }));
    const { svc, cache } = makeService();
    expect(await svc.locationOf("8.8.8.8")).toBeNull();
    const stored = cache.upsert.mock.calls[0]?.[0] as { resolved: number; expiresAt: Date; fetchedAt: Date };
    expect(stored.resolved).toBe(0);
    expect(stored.expiresAt.getTime() - stored.fetchedAt.getTime()).toBe(DAY_MS);
  });

  it("serves the stale row and stops calling while the provider rate-limits", async () => {
    const fetch = answer("", { status: 429, headers: { "retry-after": "60" } });
    vi.stubGlobal("fetch", fetch);
    const { svc, cache } = makeService();
    cache.findOne.mockResolvedValue(row({ expiresAt: new Date(Date.now() - DAY_MS) }));
    expect(await svc.locationOf("8.8.8.8")).toMatchObject({ countryCode: "US" });
    expect(await svc.locationOf("8.8.8.8")).toMatchObject({ countryCode: "US" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cache.upsert).not.toHaveBeenCalled();
  });

  it("serves the stale row when the provider is down, and writes nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );
    const { svc, cache } = makeService();
    cache.findOne.mockResolvedValue(row({ expiresAt: new Date(Date.now() - DAY_MS) }));
    expect(await svc.locationOf("8.8.8.8")).toMatchObject({ countryCode: "US" });
    expect(cache.upsert).not.toHaveBeenCalled();
  });
});

describe("GeoipService.countriesFor", () => {
  it("resolves a page of rows once per distinct address, reserved ones staying blank", async () => {
    const fetch = answer(IPWHO);
    vi.stubGlobal("fetch", fetch);
    const { svc, cache } = makeService();
    cache.findOne.mockResolvedValue(row());
    const found = await svc.countriesFor(["8.8.8.8", "8.8.8.8", "127.0.0.1"]);
    expect(found.size).toBe(2);
    expect(found.get("8.8.8.8")).toBe("US");
    expect(found.get("127.0.0.1")).toBe("");
    expect(cache.findOne).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
