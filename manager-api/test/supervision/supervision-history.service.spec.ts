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
    net_in: 10,
    net_out: 20,
    ...over,
  };
}

describe("SupervisionHistoryService", () => {
  let query: ReturnType<typeof vi.fn>;
  let service: SupervisionHistoryService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    query = vi.fn().mockResolvedValue([]);
    service = new SupervisionHistoryService(providerMock<DataSource>({ query }));
  });
  afterEach(() => vi.useRealTimers());

  it("groups the window in SQL, over the index, with the step of that window", async () => {
    await service.read("hour");
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("metrics_history");
    expect(sql).toContain("GROUP BY 1");
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

  // A bucket nothing was recorded in is a hole, not a zero: the chart cuts its
  // curve there rather than drawing a machine that was never measured.
  it("returns every bucket of the window, the empty ones with null figures", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    query.mockResolvedValue([bucket(at + step)]);

    const { points } = await service.read("hour");
    expect(points[0]).toEqual({ at, cpu: null, load: null, memory: null, network: null });
    expect(points[1]).toEqual({ at: at + step, cpu: 12.5, load: [1, 2, 3], memory: 25, network: [10, 20] });
  });

  // The driver hands aggregates back as strings often enough that a point would
  // otherwise be drawn from "12.5" and land nowhere.
  it("reads the driver's strings back as numbers", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    query.mockResolvedValue([
      bucket(String(at), { cpu: "12.5", load1: "1", load5: "2", load15: "3", memory_used: "250", memory_total: "1000" }),
    ]);

    const { points } = await service.read("hour");
    expect(points[0]).toEqual({ at, cpu: 12.5, load: [1, 2, 3], memory: 25, network: [10, 20] });
  });

  it("keeps a bucket with no recorded rate as a hole in the network curve alone", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    query.mockResolvedValue([bucket(at, { net_in: null, net_out: null })]);

    const { points } = await service.read("hour");
    expect(points[0]).toMatchObject({ cpu: 12.5, network: null });
  });

  it("reports no memory at all rather than dividing by a total of zero", async () => {
    const step = METRIC_RANGES.hour.step;
    const at = Math.floor((NOW - METRIC_RANGES.hour.span) / step) * step;
    query.mockResolvedValue([bucket(at, { memory_total: 0, memory_used: 0 })]);

    const { points } = await service.read("hour");
    expect(points[0]?.memory).toBe(0);
  });
});
