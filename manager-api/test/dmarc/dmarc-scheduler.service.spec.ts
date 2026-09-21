import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { DmarcInboxService } from "../../src/core/dmarc/dmarc-inbox.service";
import type { DmarcIngestService } from "../../src/core/dmarc/dmarc-ingest.service";
import type { DmarcRecipientsService } from "../../src/core/dmarc/dmarc-recipients.service";
import type { DmarcReporterService } from "../../src/core/dmarc/dmarc-reporter.service";
import {
  DmarcSchedulerService,
  INGEST_EVERY_MS,
  REPORT_CHECK_EVERY_MS,
  SCAN_EVERY_MS,
} from "../../src/core/dmarc/dmarc-scheduler.service";
import type { DmarcSettingsService } from "../../src/core/dmarc/dmarc-settings.service";
import { providerMock } from "../helpers/mocks";

describe("DmarcSchedulerService", () => {
  const ingest = { ingest: vi.fn() };
  const recipients = { resolve: vi.fn() };
  const scan = { scan: vi.fn(), prune: vi.fn() };
  const reporter = { run: vi.fn(), prune: vi.fn() };
  const get = vi.fn();
  let svc: DmarcSchedulerService;

  const at = (hour: number, day = 21) => new Date(2026, 8, day, hour, 30).getTime();

  beforeEach(() => {
    vi.clearAllMocks();
    ingest.ingest.mockResolvedValue(0);
    recipients.resolve.mockResolvedValue(0);
    scan.scan.mockResolvedValue({});
    scan.prune.mockResolvedValue(undefined);
    reporter.run.mockResolvedValue({ day: "2026-09-20", sent: 1, failed: 0, skipped: 0 });
    reporter.prune.mockResolvedValue(undefined);
    get.mockResolvedValue({ sendingEnabled: true, reportHour: 2 });
    svc = new DmarcSchedulerService(
      providerMock<DmarcIngestService>(ingest),
      providerMock<DmarcRecipientsService>(recipients),
      providerMock<DmarcInboxService>(scan),
      providerMock<DmarcReporterService>(reporter),
      providerMock<DmarcSettingsService>({ get })
    );
  });
  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("prunes once a day, whatever the settings", async () => {
    get.mockResolvedValue({ sendingEnabled: false, reportHour: 2 });
    await svc.daily(at(1));
    await svc.daily(at(5));
    expect(reporter.prune).toHaveBeenCalledTimes(1);
    expect(scan.prune).toHaveBeenCalledTimes(1);
    await svc.daily(at(1, 22));
    expect(reporter.prune).toHaveBeenCalledTimes(2);
    expect(reporter.run).not.toHaveBeenCalled();
  });

  it("sends yesterday's reports once, after the report hour, having read the history first", async () => {
    await svc.daily(at(1));
    expect(reporter.run).not.toHaveBeenCalled();
    await svc.daily(at(3));
    await svc.daily(at(4));
    expect(ingest.ingest).toHaveBeenCalledTimes(1);
    expect(recipients.resolve).toHaveBeenCalledTimes(1);
    expect(reporter.run).toHaveBeenCalledTimes(1);
    expect(reporter.run.mock.calls[0]?.[0]).toMatchObject({ day: new Date(at(3) - 86_400_000).toISOString().slice(0, 10) });
  });

  it("starts nothing under the test runner", () => {
    const every = vi.spyOn(globalThis, "setInterval");
    svc.onApplicationBootstrap();
    expect(every).not.toHaveBeenCalled();
  });

  it("runs each job on its own clock once the application is up, and swallows a failing job", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "development");
    ingest.ingest.mockRejectedValueOnce(new Error("boom"));
    svc.onApplicationBootstrap();

    await vi.advanceTimersByTimeAsync(INGEST_EVERY_MS);
    expect(ingest.ingest).toHaveBeenCalledTimes(1);
    expect(recipients.resolve).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(INGEST_EVERY_MS);
    expect(recipients.resolve).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(Math.max(SCAN_EVERY_MS, REPORT_CHECK_EVERY_MS) - 2 * INGEST_EVERY_MS);
    expect(scan.scan).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalled();

    svc.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(SCAN_EVERY_MS);
    expect(scan.scan).toHaveBeenCalledTimes(1);
  });
});
