import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceMetricsService, countersOf } from "../../src/core/supervision/service-metrics.service";
import type { RspamdService, RspamdStats } from "../../src/core/rspamd/rspamd.service";
import type { PostfixService, PostfixQueueStats } from "../../src/core/postfix/postfix.service";
import { entity, providerMock } from "../helpers/mocks";

function stats(over: Partial<RspamdStats["actions"]> = {}, scanned = 100, learned = 7): RspamdStats {
  return entity<RspamdStats>({
    scanned,
    learned,
    actions: {
      reject: 5,
      "soft reject": 1,
      "rewrite subject": 2,
      "add header": 8,
      greylist: 4,
      "no action": 80,
      ...over,
    },
  });
}

const COUNTERS = { scanned: 100, noAction: 80, greylist: 4, addHeader: 8, reject: 5, learned: 7 };

function queue(total: Partial<PostfixQueueStats["total"]> = {}, available = true): PostfixQueueStats {
  return { total: { active: 1, deferred: 3, hold: 0, incoming: 2, ...total }, available };
}

describe("countersOf", () => {
  it("keeps rspamd's own tiles: the four verdicts drawn, the scan total and what was learned", () => {
    expect(countersOf(stats())).toEqual(COUNTERS);
  });

  it("counts nothing learned when rspamd does not say", () => {
    expect(countersOf(entity<RspamdStats>({ ...stats(), learned: undefined })).learned).toBe(0);
  });
});

describe("ServiceMetricsService", () => {
  let rspamdStats: ReturnType<typeof vi.fn>;
  let queueStats: ReturnType<typeof vi.fn>;
  let service: ServiceMetricsService;

  beforeEach(() => {
    rspamdStats = vi.fn(async () => stats());
    queueStats = vi.fn(async () => queue());
    service = new ServiceMetricsService(
      providerMock<RspamdService>({ stats: rspamdStats }),
      providerMock<PostfixService>({ queueStats })
    );
  });

  it("carries rspamd's counters and the queues as they stand", async () => {
    const sample = await service.sample();
    expect(sample.rspamd).toEqual(COUNTERS);
    expect(sample.postfix).toEqual({ active: 1, deferred: 3, hold: 0, incoming: 2 });
  });

  it("follows the counters as they climb", async () => {
    await service.sample();
    rspamdStats.mockResolvedValueOnce(stats({ "no action": 83, reject: 6 }, 104, 9));
    const sample = await service.sample();
    expect(sample.rspamd).toEqual({ scanned: 104, noAction: 83, greylist: 4, addHeader: 8, reject: 6, learned: 9 });
  });

  it("reports rspamd as out of reach without failing the sample, and reads it again when it is back", async () => {
    rspamdStats.mockRejectedValueOnce(new Error("rspamd unreachable"));
    const away = await service.sample();
    expect(away.rspamd).toBeNull();
    expect(away.postfix).not.toBeNull();

    const back = await service.sample();
    expect(back.rspamd).toEqual(COUNTERS);
  });

  it("reports the spool as out of reach when postfix says so", async () => {
    queueStats.mockResolvedValueOnce(queue({}, false));
    const sample = await service.sample();
    expect(sample.postfix).toBeNull();
    expect(sample.rspamd).toEqual(COUNTERS);
  });

  it("reports the spool as out of reach when reading it throws", async () => {
    queueStats.mockRejectedValueOnce(new Error("spool gone"));
    const sample = await service.sample();
    expect(sample.postfix).toBeNull();
  });

  it("asks postfix for the whole queue, never a domain's share of it", async () => {
    await service.sample();
    expect(queueStats).toHaveBeenCalledWith();
  });
});
