import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClamavUpdaterService } from "../../src/core/clamav/clamav-updater.service";

const OUTPUT = ["Sun Sep 20 14:04:25 2026 -> daily.cld database is up-to-date (version: 28129)"];

function answer(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("ClamavUpdaterService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: ClamavUpdaterService;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    service = new ClamavUpdaterService(new ConfigService({ CLAMAV_API_URL: "http://clamav.test:8082" }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks the updater in the scanner's own container, and answers what freshclam did", async () => {
    fetchMock.mockResolvedValue(answer(200, { output: OUTPUT, updated: true }));

    expect(await service.update()).toEqual({ output: OUTPUT, updated: true });
    expect(fetchMock).toHaveBeenCalledWith("http://clamav.test:8082/update", expect.objectContaining({ method: "POST" }));
  });

  it("reads an answer with nothing in it as an update that downloaded nothing", async () => {
    fetchMock.mockResolvedValue(answer(200, {}));
    expect(await service.update()).toEqual({ output: [], updated: false });
  });

  // A run already under way is an answer, not a failure: the first one is still
  // going, and a second freshclam would only wait on its lock.
  it("says so when an update is already running", async () => {
    fetchMock.mockResolvedValue(answer(409, { error: "an update is already running" }));
    await expect(service.update()).rejects.toBeInstanceOf(ConflictException);
  });

  it("carries freshclam's own reason when it fails", async () => {
    fetchMock.mockResolvedValue(answer(502, { error: "Can't download daily.cvd" }));
    await expect(service.update()).rejects.toThrow("Can't download daily.cvd");
  });

  it("says the updater is out of reach when nothing answers", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(service.update()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("stands a failure that carries no reason", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);
    await expect(service.update()).rejects.toThrow("clamav-api POST /update -> 500");
  });

  it("falls back to the mail network address when nothing names one", async () => {
    fetchMock.mockResolvedValue(answer(200, { output: [], updated: false }));
    await new ClamavUpdaterService(new ConfigService({})).update();
    expect(fetchMock).toHaveBeenCalledWith("http://172.200.0.12:8082/update", expect.anything());
  });
});
