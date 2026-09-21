import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { DataSource } from "typeorm";
import { METRIC_RANGES, SupervisionHistoryService } from "../../src/core/supervision/supervision-history.service";
import { providerMock } from "../helpers/mocks";

const NOW = 1_800_000_000_000;

// `at` is a string in one case on purpose: the driver hands aggregates back
// that way often enough that a point would otherwise be drawn from "12.5".
function bucket(at: number | string, over: Record<string, unknown> = {}) {
  return {
    at,
    cpu: 12.5,
    load1: 1,
    load5: 2,
    load15: 3,
    memory_used: 250,
    memory_total: 1000,
    disk_used: 500,
    disk_total: 2000,
    net_in: 10,
    net_out: 20,
    rspamd_scanned: 14,
    rspamd_no_action: 11,
    rspamd_greylist: 1,
    rspamd_add_header: 1,
    rspamd_reject: 1,
    rspamd_learned: 0,
    postfix_active: 0.5,
    postfix_deferred: 3,
    postfix_hold: 0,
    postfix_incoming: 0,
    clamav_age: 32400,
    ...over,
  };
}

const RSPAMD = [14, 11, 1, 1, 1, 0];
const POSTFIX = [0.5, 3, 0, 0];

describe("SupervisionHistoryService", () => {
  let query: ReturnType<typeof vi.fn>;
  let rows: unknown[];
  let banRows: unknown[];
  let service: SupervisionHistoryService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    rows = [];
    banRows = [];
    query = vi.fn(async (sql: string) => (sql.includes("fail2ban_history") ? banRows : rows));
    service = new SupervisionHistoryService(providerMock<DataSource>({ query }));
  });
  afterEach(() => vi.useRealTimers());

  it("groups the window in SQL, over the index, with the step of that window", async () => {
    await service.read("hour");
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("metrics_history");
    expect(sql).toContain("GROUP BY 1");
    // Every figure of the bucket is the highest it reached, in the one query.
    expect(sql).toContain("MAX(cpu)");
    expect(sql).toContain("MAX(load_1)");
    expect(sql).toContain("MAX(rspamd_no_action)");
    expect(sql).toContain("ROUND(SUM(postfix_deferred) * 10)");
    expect(params).toEqual([60_000, 60_000, NOW - 3_600_000]);
  });

  it.each(Object.keys(METRIC_RANGES) as ("hour" | "day" | "week")[])("answers the %s window at its own step", async (range) => {
    const { span, step } = METRIC_RANGES[range];
    const window = await service.read(range);
    expect(window.range).toBe(range);
    expect(window.step).toBe(step);
    // One point per bucket of the whole window, whatever was recorded in it.
    expect(window.points).toHaveLength(Math.floor((NOW - Math.floor((NOW - span) / step) * step) / step) + 1);
  });

  it("hands each bucket the highest bans of every fail2ban jail, even a bucket with no machine row", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    rows = [bucket(at + step)];
    banRows = [
      { at: String(at), jail: "dovecot", banned: "1.5" },
      { at: at + step, jail: "dovecot", banned: 2 },
      { at: at + step, jail: "manager", banned: 1 },
    ];

    const { points } = await service.read("hour");
    expect(points[0]?.fail2ban).toEqual({ dovecot: 1.5 });
    expect(points[0]?.cpu).toBeNull();
    expect(points[1]?.fail2ban).toEqual({ dovecot: 2, manager: 1 });
    expect(points[2]?.fail2ban).toBeNull();
    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("GROUP BY 1, jail");
    expect(params).toEqual([step, step, NOW - METRIC_RANGES.hour.span]);
  });

  // A bucket nothing was recorded in is a hole, not a zero: the chart cuts its
  // curve there rather than drawing a machine that was never measured.
  it("returns every bucket of the window, the empty ones with null figures", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    rows = [bucket(at + step)];

    const { points } = await service.read("hour");
    expect(points[0]).toEqual({
      at,
      cpu: null,
      load: null,
      memory: null,
      disk: null,
      network: null,
      rspamd: null,
      postfix: null,
      fail2ban: null,
      clamavAge: null,
    });
    expect(points[1]).toEqual({
      at: at + step,
      cpu: 12.5,
      load: [1, 2, 3],
      memory: 25,
      disk: [500, 2000],
      network: [10, 20],
      rspamd: RSPAMD,
      postfix: POSTFIX,
      fail2ban: null,
      clamavAge: 32400,
    });
  });

  // The driver hands aggregates back as strings often enough that a point would
  // otherwise be drawn from "12.5" and land nowhere.
  it("reads the driver's strings back as numbers", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    rows = [
      bucket(String(at), {
        cpu: "12.5",
        load1: "1",
        load5: "2",
        load15: "3",
        memory_used: "250",
        memory_total: "1000",
        rspamd_scanned: "14",
        rspamd_no_action: "11",
        postfix_active: "0.5",
      }),
    ];

    const { points } = await service.read("hour");
    expect(points[0]).toEqual({
      at,
      cpu: 12.5,
      load: [1, 2, 3],
      memory: 25,
      disk: [500, 2000],
      network: [10, 20],
      rspamd: RSPAMD,
      postfix: POSTFIX,
      fail2ban: null,
      clamavAge: 32400,
    });
  });

  // A service's figures stand or fall together: one missing is the service out
  // of reach for the bucket, and the other service's curve is left whole.
  it("keeps a bucket during which one service was out of reach as a hole in that curve alone", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    rows = [
      bucket(at, {
        rspamd_scanned: null,
        rspamd_no_action: null,
        rspamd_greylist: null,
        rspamd_add_header: null,
        rspamd_reject: null,
        rspamd_learned: null,
      }),
      bucket(at + step, { postfix_hold: null }),
    ];

    const { points } = await service.read("hour");
    expect(points[0]).toMatchObject({ cpu: 12.5, rspamd: null, postfix: POSTFIX });
    expect(points[1]).toMatchObject({ cpu: 12.5, rspamd: RSPAMD, postfix: null });
  });

  it("keeps a bucket with no recorded rate as a hole in the network curve alone", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    rows = [bucket(at, { net_in: null, net_out: null })];

    const { points } = await service.read("hour");
    expect(points[0]).toMatchObject({ cpu: 12.5, network: null });
  });

  it("reports no memory at all rather than dividing by a total of zero", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    rows = [bucket(at, { memory_total: 0, memory_used: 0 })];

    const { points } = await service.read("hour");
    expect(points[0]?.memory).toBe(0);
  });
});
