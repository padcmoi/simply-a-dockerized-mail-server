import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { GeocodingService } from "../../src/core/geocoding/geocoding.service";

// Silence and observe the service's warn-only logger.
vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

function okResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response;
}

describe("GeocodingService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let svc: GeocodingService;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    svc = new GeocodingService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEOCODER_USER_AGENT;
  });

  it("returns the first result's coordinates and builds the city+country query", async () => {
    fetchMock.mockResolvedValue(okResponse([{ lat: "48.85", lon: "2.35" }]));
    const res = await svc.geocodeCity("Paris", "France");
    expect(res).toEqual({ latitude: "48.85", longitude: "2.35" });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("q=Paris%2C%20France");
    expect((opts as RequestInit).headers).toEqual({ "User-Agent": "simply-mail-server-manager/1.0" });
  });

  it("queries the city alone when no country is given", async () => {
    fetchMock.mockResolvedValue(okResponse([{ lat: "1", lon: "2" }]));
    await svc.geocodeCity("Berlin");
    expect(fetchMock.mock.calls[0][0]).toContain("q=Berlin");
    expect(fetchMock.mock.calls[0][0]).not.toContain("%2C");
  });

  it("honors GEOCODER_USER_AGENT when set", async () => {
    process.env.GEOCODER_USER_AGENT = "my-agent/9";
    fetchMock.mockResolvedValue(okResponse([{ lat: "1", lon: "2" }]));
    await svc.geocodeCity("Rome");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({ "User-Agent": "my-agent/9" });
  });

  it("returns null on a non-ok HTTP response", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => [] } as unknown as Response);
    await expect(svc.geocodeCity("Nowhere")).resolves.toBeNull();
  });

  it("returns null when the result array is empty", async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await expect(svc.geocodeCity("Nowhere")).resolves.toBeNull();
  });

  it("returns null when the first result is missing a longitude", async () => {
    fetchMock.mockResolvedValue(okResponse([{ lat: "1" }]));
    await expect(svc.geocodeCity("Nowhere")).resolves.toBeNull();
  });

  it("returns null when the first result is missing a latitude", async () => {
    fetchMock.mockResolvedValue(okResponse([{ lon: "2" }]));
    await expect(svc.geocodeCity("Nowhere")).resolves.toBeNull();
  });

  it("never throws: a fetch rejection yields null and a warning", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(svc.geocodeCity("Paris")).resolves.toBeNull();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});
