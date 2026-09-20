import { Fail2banHistory } from "../../src/core/entities/fail2ban-history.entity";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LessThan } from "typeorm";
import { MetricsHistory } from "../../src/core/entities/metrics-history.entity";
import { LIVE_POINTS, SupervisionRecorderService } from "../../src/core/supervision/supervision-recorder.service";
import type { SystemMetricsService, SystemSnapshot } from "../../src/core/supervision/system-metrics.service";
import { APP_SETTINGS_DEFAULTS, type AppSettingsService } from "../../src/core/settings/app-settings.service";
import type { ClamavAlertsService } from "../../src/core/clamav/clamav-alerts.service";
import type { MachineAlertsService } from "../../src/core/supervision/machine-alerts.service";
import type { ServiceMetricsService, ServiceSample } from "../../src/core/supervision/service-metrics.service";
import { providerMock, repoMock } from "../helpers/mocks";

function snapshotAt(at: number, over: Partial<SystemSnapshot> = {}): SystemSnapshot {
  return {
    at,
    cores: 8,
    cpu: 10,
    load: { one: 1, five: 2, fifteen: 3 },
    memory: { total: 1000, used: 400 },
    disk: { total: 2000, used: 500 },
    network: { interface: "eth0", in: 100, out: 200 },
    ...over,
  };
}

/** An hour before the moment every spec here sets the clock to. */
const SIGNATURES_AT = 1_800_000_000_000 - 3_600_000;

function servicesSample(over: Partial<ServiceSample> = {}): ServiceSample {
  return {
    rspamd: { scanned: 100, noAction: 80, greylist: 4, addHeader: 8, reject: 5, learned: 7 },
    postfix: { active: 1, deferred: 3, hold: 0, incoming: 0 },
    fail2ban: { dovecot: 2, manager: 1 },
    clamav: { available: true, signaturesAt: SIGNATURES_AT },
    ...over,
  };
}

describe("SupervisionRecorderService", () => {
  const history = repoMock<MetricsHistory>();
  const bans = repoMock<Fail2banHistory>();
  let now = 1_800_000_000_000;
  let sample: ReturnType<typeof vi.fn>;
  let services: ReturnType<typeof vi.fn>;
  let inspect: ReturnType<typeof vi.fn>;
  let inspectClamav: ReturnType<typeof vi.fn>;
  let service: SupervisionRecorderService;
  let retentionMs = 30 * 24 * 3_600_000;

  // The tick is driven by the websocket poller, so time is driven here too.
  function build() {
    sample = vi.fn(async () => snapshotAt(now));
    services = vi.fn(async () => servicesSample());
    inspect = vi.fn(async () => undefined);
    inspectClamav = vi.fn(async () => undefined);
    const metrics = providerMock<SystemMetricsService>({ sample });
    const serviceMetrics = providerMock<ServiceMetricsService>({ sample: services });
    const settings = providerMock<AppSettingsService>({
      get: vi.fn(() => ({ ...APP_SETTINGS_DEFAULTS, supervisionRetentionMs: retentionMs })),
    });
    const alerts = providerMock<MachineAlertsService>({ inspect });
    const clamavAlerts = providerMock<ClamavAlertsService>({ inspect: inspectClamav });
    return new SupervisionRecorderService(metrics, serviceMetrics, history, bans, settings, alerts, clamavAlerts);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    retentionMs = 30 * 24 * 3_600_000;
    history.insert.mockResolvedValue(undefined);
    history.delete.mockResolvedValue(undefined);
    bans.insert.mockResolvedValue(undefined);
    bans.delete.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(now);
    service = build();
  });
  afterEach(() => vi.useRealTimers());

  function advance(ms: number) {
    now += ms;
    vi.setSystemTime(now);
  }

  it("returns the snapshot it just sampled and keeps it as the latest", async () => {
    const snapshot = await service.tick();
    expect(snapshot.at).toBe(now);
    expect(service.latest()).toBe(snapshot);
    expect(service.recent()).toEqual([snapshot]);
  });

  // One loop, one clock: the services ride on the machine's own sample, so a
  // frame carries both and nothing else reads them.
  it("reads the two services on the same tick and carries them on the snapshot", async () => {
    const snapshot = await service.tick();
    expect(services).toHaveBeenCalledTimes(1);
    expect(snapshot).toMatchObject({ cpu: 10, ...servicesSample() });
    expect(inspect).toHaveBeenCalledWith(snapshot);
  });

  it("prunes once at boot, so a host restarted daily still drops the month before it", async () => {
    await service.tick();
    expect(history.delete).toHaveBeenCalledWith({ at: LessThan(now - 30 * 24 * 3_600_000) });
    expect(history.delete).toHaveBeenCalledTimes(1);
    expect(bans.delete).toHaveBeenCalledWith({ at: LessThan(now - 30 * 24 * 3_600_000) });
  });

  // Read on every pass rather than at boot: a retention changed in the settings
  // page has to apply to the next purge, not at the next restart.
  it("purges against the retention the settings hold at that moment", async () => {
    retentionMs = 7 * 86_400_000;
    service = build();
    await service.tick();
    expect(history.delete).toHaveBeenCalledWith({ at: LessThan(now - 7 * 86_400_000) });
  });

  it("writes nothing before ten seconds have passed", async () => {
    for (let i = 0; i < 4; i += 1) {
      await service.tick();
      advance(2000);
    }
    expect(history.insert).not.toHaveBeenCalled();
  });

  // The average of what came in rather than the last of it: a row standing for
  // ten seconds should say what those ten seconds were.
  it("averages the batch into a single row every ten seconds", async () => {
    const values = [0, 20, 40, 60, 80];
    for (const cpu of values) {
      sample.mockResolvedValueOnce(snapshotAt(now, { cpu, memory: { total: 1000, used: cpu * 10 } }));
      await service.tick();
      advance(2500);
    }
    await service.tick();

    expect(history.insert).toHaveBeenCalledTimes(1);
    expect(history.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cpu: 40,
        memoryUsed: 400,
        memoryTotal: 1000,
        diskUsed: 500,
        diskTotal: 2000,
        load1: 1,
        load5: 2,
        load15: 3,
      })
    );
  });

  it("keeps a null cpu out of the average rather than counting it as zero", async () => {
    sample.mockResolvedValueOnce(snapshotAt(now, { cpu: null }));
    await service.tick();
    advance(11_000);
    sample.mockResolvedValueOnce(snapshotAt(now, { cpu: 30 }));
    await service.tick();

    expect(history.insert).toHaveBeenCalledWith(expect.objectContaining({ cpu: 30 }));
  });

  it("records the mean number of bans of each fail2ban jail over the row", async () => {
    services.mockResolvedValueOnce(servicesSample({ fail2ban: { dovecot: 1, manager: 1 } }));
    services.mockResolvedValueOnce(servicesSample({ fail2ban: { dovecot: 3, manager: 1, "postfix-sasl": 4 } }));
    await service.tick();
    advance(11_000);
    await service.tick();

    expect(bans.insert).toHaveBeenCalledWith([
      { at: now, jail: "dovecot", banned: 2 },
      { at: now, jail: "manager", banned: 1 },
      { at: now, jail: "postfix-sasl", banned: 4 },
    ]);
  });

  it("records no ban row while fail2ban is out of reach", async () => {
    services.mockImplementation(async () => servicesSample({ fail2ban: null }));
    await service.tick();
    advance(11_000);
    await service.tick();

    expect(history.insert).toHaveBeenCalled();
    expect(bans.insert).not.toHaveBeenCalled();
  });

  it("keeps going when the ban rows cannot be written", async () => {
    bans.insert.mockRejectedValueOnce(new Error("db is away"));
    await service.tick();
    advance(11_000);
    await expect(service.tick()).resolves.toBeDefined();
  });

  it("records no rate at all for a host whose interfaces are out of reach", async () => {
    sample.mockImplementation(async () => snapshotAt(now, { network: null }));
    await service.tick();
    advance(11_000);
    await service.tick();

    expect(history.insert).toHaveBeenCalledWith(expect.objectContaining({ netIn: null, netOut: null }));
  });

  it("records no disk for a host whose root filesystem is out of reach", async () => {
    sample.mockImplementation(async () => snapshotAt(now, { disk: null }));
    await service.tick();
    advance(11_000);
    await service.tick();

    expect(history.insert).toHaveBeenCalledWith(expect.objectContaining({ diskUsed: null, diskTotal: null }));
  });

  // rspamd's counters only climb, so the row says where they stood at its end,
  // like the load; a queue's depth is averaged over the row.
  it("writes rspamd's last counters and the queues' mean into the same row", async () => {
    const steps = [
      { scanned: 100, deferred: 0 },
      { scanned: 102, deferred: 2 },
      { scanned: 105, deferred: 4 },
    ];
    for (const step of steps) {
      services.mockResolvedValueOnce(
        servicesSample({
          rspamd: { scanned: step.scanned, noAction: step.scanned - 20, greylist: 4, addHeader: 8, reject: 5, learned: 7 },
          postfix: { active: 1, deferred: step.deferred, hold: 0, incoming: 0 },
        })
      );
      await service.tick();
      advance(5000);
    }

    expect(history.insert).toHaveBeenCalledTimes(1);
    expect(history.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cpu: 10,
        rspamdScanned: 105,
        rspamdNoAction: 85,
        rspamdGreylist: 4,
        rspamdAddHeader: 8,
        rspamdReject: 5,
        rspamdLearned: 7,
        postfixActive: 1,
        postfixDeferred: 2,
        postfixHold: 0,
        postfixIncoming: 0,
      })
    );
  });

  it("records nothing for rspamd when every sample of the row had it out of reach", async () => {
    services.mockImplementation(async () => servicesSample({ rspamd: null }));
    await service.tick();
    advance(11_000);
    await service.tick();
    expect(history.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        rspamdScanned: null,
        rspamdNoAction: null,
        rspamdGreylist: null,
        rspamdAddHeader: null,
        rspamdReject: null,
        rspamdLearned: null,
        postfixActive: 1,
        cpu: 10,
      })
    );
  });

  it("records nothing for postfix when every sample of the row had the spool out of reach", async () => {
    services.mockImplementation(async () => servicesSample({ postfix: null }));
    await service.tick();
    advance(11_000);
    await service.tick();
    expect(history.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        postfixActive: null,
        postfixDeferred: null,
        postfixHold: null,
        postfixIncoming: null,
        rspamdScanned: 100,
      })
    );
  });

  // rspamd away for the last second of a row is not rspamd away for the row:
  // the counters it last gave are what the row keeps.
  it("keeps the last counters rspamd gave when it is away at the moment of the write", async () => {
    await service.tick();
    advance(5000);
    services.mockResolvedValueOnce(
      servicesSample({ rspamd: { scanned: 103, noAction: 83, greylist: 4, addHeader: 8, reject: 5, learned: 7 } })
    );
    await service.tick();
    advance(6000);
    services.mockResolvedValueOnce(servicesSample({ rspamd: null }));
    await service.tick();
    expect(history.insert).toHaveBeenCalledWith(expect.objectContaining({ rspamdScanned: 103, rspamdNoAction: 83 }));
  });

  it("holds the live window to the minute the cards draw", async () => {
    for (let i = 0; i < LIVE_POINTS + 10; i += 1) {
      await service.tick();
      advance(2000);
    }
    const points = service.recent();
    expect(points).toHaveLength(LIVE_POINTS);
    expect(points[points.length - 1]?.at).toBe(now - 2000);
  });

  // The sampling loop is also the websocket feed: a database that refuses a row
  // must not take the live cards down with it.
  it("keeps sampling when the write fails", async () => {
    history.insert.mockRejectedValue(new Error("db is away"));
    await service.tick();
    advance(11_000);
    await expect(service.tick()).resolves.toMatchObject({ at: now });
  });

  it("keeps sampling when the prune fails", async () => {
    history.delete.mockRejectedValue(new Error("db is away"));
    await expect(service.tick()).resolves.toMatchObject({ at: now });
  });
});
