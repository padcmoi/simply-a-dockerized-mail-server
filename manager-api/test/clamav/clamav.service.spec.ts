import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { ClamavService } from "../../src/core/clamav/clamav.service";
import type { ClamavDatabasesService } from "../../src/core/clamav/clamav-databases.service";
import type { ClamavPublishedService } from "../../src/core/clamav/clamav-published.service";
import type { ClamavUpdaterService } from "../../src/core/clamav/clamav-updater.service";
import type { ClamdClient } from "../../src/core/clamav/clamd.client";
import { providerMock } from "../helpers/mocks";

const STATS = { threadsLive: 1, threadsIdle: 0, threadsMax: 12, queue: 0, poolsUsed: 1_000 };

function file(name: string, version: number, builtAt: number) {
  return { name, file: `${name}.cvd`, version, builtAt, signatures: 10, bytes: 100, published: null, behind: null };
}

describe("ClamavService", () => {
  const clamd = { ping: vi.fn(), version: vi.fn(), stats: vi.fn(), reload: vi.fn() };
  const files = { read: vi.fn() };
  const published = { read: vi.fn() };
  const updater = { update: vi.fn() };

  const service = new ClamavService(
    providerMock<ClamdClient>(clamd),
    providerMock<ClamavDatabasesService>(files),
    providerMock<ClamavPublishedService>(published),
    providerMock<ClamavUpdaterService>(updater)
  );

  beforeEach(() => {
    vi.clearAllMocks();
    clamd.ping.mockResolvedValue(true);
    clamd.version.mockResolvedValue("ClamAV 1.4.6/28129/Sun Sep 20 06:26:26 2026");
    clamd.stats.mockResolvedValue(STATS);
    clamd.reload.mockResolvedValue(true);
    files.read.mockReturnValue([file("main", 63, 1_000), file("daily", 28_128, 3_000)]);
    published.read.mockResolvedValue({ engine: "1.4.6", versions: { main: 63, daily: 28_129 } });
    updater.update.mockResolvedValue({ output: ["done"], updated: false });
  });

  it("puts clamd, the files and the published versions into one answer", async () => {
    const status = await service.status();

    expect(status.available).toBe(true);
    expect(status.engine).toEqual({ version: "1.4.6", published: "1.4.6", outdated: false });
    expect(status.stats).toEqual(STATS);
    // The newest build date of the three, which is what the page dates the
    // signatures with.
    expect(status.signaturesAt).toBe(3_000);
  });

  it("says how many versions each database is short of the published one", async () => {
    const [main, daily] = (await service.status()).databases;
    expect(main).toMatchObject({ published: 63, behind: 0 });
    expect(daily).toMatchObject({ published: 28_129, behind: 1 });
  });

  // A database ahead of the record is a record read a moment too early, not a
  // negative distance.
  it("never reports a database as being ahead", async () => {
    files.read.mockReturnValue([file("daily", 28_130, 3_000)]);
    expect((await service.status()).databases[0]).toMatchObject({ behind: 0 });
  });

  it("leaves a database with nothing to compare to as unknown", async () => {
    published.read.mockResolvedValue({ engine: null, versions: {} });
    const status = await service.status();

    expect(status.databases[0]).toMatchObject({ published: null, behind: null });
    expect(status.engine).toEqual({ version: "1.4.6", published: null, outdated: false });
  });

  it("answers for a scanner that is out of reach, the databases still read", async () => {
    clamd.ping.mockResolvedValue(false);
    clamd.version.mockResolvedValue(null);
    clamd.stats.mockResolvedValue(null);

    const status = await service.status();
    expect(status).toMatchObject({ available: false, stats: null });
    expect(status.engine).toEqual({ version: null, published: "1.4.6", outdated: false });
    expect(status.databases).toHaveLength(2);
  });

  it("has no date at all when no database could be read", async () => {
    files.read.mockReturnValue([]);
    expect((await service.status()).signaturesAt).toBeNull();
  });

  // "1.4.10" is newer than "1.4.6", and a string comparison says the opposite.
  it.each([
    ["1.4.6", "1.4.6", false],
    ["1.4.6", "1.4.10", true],
    ["1.4.10", "1.4.6", false],
    ["1.4", "1.4.1", true],
    ["1.5.0", "1.4.9", false],
    ["nightly", "1.4.6", false],
  ])("reads the engine %s against the published %s as outdated=%s", async (running, latest, outdated) => {
    clamd.version.mockResolvedValue(`ClamAV ${running}/28129/Sun Sep 20 06:26:26 2026`);
    published.read.mockResolvedValue({ engine: latest, versions: {} });

    expect((await service.status()).engine.outdated).toBe(outdated);
  });

  describe("update", () => {
    it("answers what freshclam did, with the state taken after it", async () => {
      const result = await service.update();

      expect(updater.update).toHaveBeenCalled();
      expect(result).toMatchObject({ output: ["done"], updated: false });
      expect(result.status.available).toBe(true);
    });

    // clamd goes on scanning with the set it has in memory until it is told to
    // read the files again, so a download that changed nothing needs no reload.
    it("has clamd read the new signatures only when something was downloaded", async () => {
      await service.update();
      expect(clamd.reload).not.toHaveBeenCalled();

      updater.update.mockResolvedValue({ output: ["got daily"], updated: true });
      await service.update();
      expect(clamd.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe("reload", () => {
    it("answers the state taken after the reload", async () => {
      expect((await service.reload()).status.available).toBe(true);
      expect(clamd.reload).toHaveBeenCalled();
    });

    it("refuses when clamd did not take the command", async () => {
      clamd.reload.mockResolvedValue(false);
      await expect(service.reload()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
