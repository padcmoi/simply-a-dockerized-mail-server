import { describe, it, expect, beforeEach, vi } from "vitest";
import { HealthcheckService } from "../../src/core/healthcheck/healthcheck.service";

// Per-port socket behaviour, mutated by each test. `data` replays a banner the
// probe's accept() inspects; `error` fires the socket error path; `timeout`
// emits nothing so the probe's own 1.5s timer decides (down);
// `data-then-error` fires a late second event to exercise the settle() guard.
const state = vi.hoisted(() => ({
  behaviors: {} as Record<number, { mode: "data" | "error" | "timeout" | "data-then-error"; data?: string }>,
  // null => defer to the real os value; set a value to force it (0 total / empty
  // load-average drive the two defensive branches that never fire on a real host).
  os: { totalmem: null as number | null, loadavg: null as number[] | null },
}));

// Fake `net`: createConnection returns a socket whose registered once-handlers
// are driven on the next microtask (after rawProbe has wired them all up).
vi.mock("net", () => ({
  createConnection: vi.fn((opts: { port: number }) => {
    const handlers: Record<string, (arg?: unknown) => void> = {};
    const sock = {
      once(ev: string, cb: (arg?: unknown) => void) {
        handlers[ev] = cb;
        return sock;
      },
      write: vi.fn(),
      destroy: vi.fn(),
    };
    const b = state.behaviors[opts.port] ?? { mode: "data", data: "" };
    queueMicrotask(() => {
      if (b.mode === "error") return handlers.error?.(new Error("refused"));
      if (b.mode === "timeout") return; // let the probe timer fire
      handlers.connect?.();
      handlers.data?.(Buffer.from(b.data ?? ""));
      if (b.mode === "data-then-error") handlers.error?.(new Error("late"));
    });
    return sock;
  }),
}));

// Real os by default; two values are made overridable so the `!total` guard and
// the load-average nullish fallback can be reached (os fns are non-configurable,
// so a spy cannot; a partial module mock can).
vi.mock("os", async (importActual) => {
  const actual = await importActual<typeof import("os")>();
  return {
    ...actual,
    totalmem: () => state.os.totalmem ?? actual.totalmem(),
    loadavg: () => state.os.loadavg ?? actual.loadavg(),
  };
});

const REDIS = 6379;
const POSTFIX = 25;

describe("HealthcheckService", () => {
  let ds: { query: ReturnType<typeof vi.fn> };
  let svc: HealthcheckService;

  beforeEach(() => {
    state.behaviors[REDIS] = { mode: "data", data: "+PONG\r\n" };
    state.behaviors[POSTFIX] = { mode: "data", data: "220 mail ESMTP ready\r\n" };
    state.os.totalmem = null;
    state.os.loadavg = null;
    ds = { query: vi.fn().mockResolvedValue([{ ok: 1 }]) };
    svc = new HealthcheckService(ds as never);
  });

  // Force the numeric signals so the tier/status branches are deterministic.
  const stub = (cpu: number, memory: number, load: number) => {
    vi.spyOn(svc as never, "cpu" as never).mockResolvedValue(cpu as never);
    vi.spyOn(svc as never, "memory" as never).mockResolvedValue(memory as never);
    vi.spyOn(svc as never, "loadScore" as never).mockReturnValue(load as never);
  };

  it("runs the real cpu/memory/load probes end-to-end (shape + probe wiring)", async () => {
    const snap = await svc.snapshot();
    expect(["ok", "degraded", "down"]).toContain(snap.status);
    expect(snap.redis).toBe("ok");
    expect(snap.db).toBe("ok");
    expect(snap.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(snap.cpuPercent).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high"]).toContain(snap.cpu);
    expect(snap.loadSignal).toMatch(/^up \d+%$/);
    expect(ds.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("reports ok with all-low tiers when every probe is healthy", async () => {
    stub(10, 10, 10);
    const snap = await svc.snapshot();
    expect(snap).toMatchObject({ status: "ok", cpu: "low", memory: "low", charge: "low", redis: "ok", db: "ok" });
    expect(snap.loadSignal).toBe("up 90%");
  });

  it("classifies mid-range signals as medium and stays ok", async () => {
    stub(60, 70, 65);
    const snap = await svc.snapshot();
    expect(snap).toMatchObject({ status: "ok", cpu: "medium", memory: "medium", charge: "medium" });
  });

  it("degrades when CPU is high", async () => {
    stub(85, 10, 10);
    const snap = await svc.snapshot();
    expect(snap.cpu).toBe("high");
    expect(snap.status).toBe("degraded");
  });

  it("degrades when memory is high", async () => {
    stub(10, 85, 10);
    const snap = await svc.snapshot();
    expect(snap.memory).toBe("high");
    expect(snap.status).toBe("degraded");
  });

  it("degrades when load (charge) is high while mail is up", async () => {
    stub(10, 10, 85);
    const snap = await svc.snapshot();
    expect(snap.charge).toBe("high");
    expect(snap.status).toBe("degraded");
  });

  it("is down whenever the database probe fails, regardless of the rest", async () => {
    stub(10, 10, 10);
    ds.query.mockRejectedValueOnce(new Error("no db"));
    const snap = await svc.snapshot();
    expect(snap.db).toBe("down");
    expect(snap.status).toBe("down");
  });

  it("degrades when redis answers with a non-PONG banner", async () => {
    stub(10, 10, 10);
    state.behaviors[REDIS] = { mode: "data", data: "-ERR loading\r\n" };
    const snap = await svc.snapshot();
    expect(snap.redis).toBe("down");
    expect(snap.status).toBe("degraded");
  });

  it("degrades and flips charge to down when the postfix socket errors", async () => {
    stub(10, 10, 10);
    state.behaviors[POSTFIX] = { mode: "error" };
    const snap = await svc.snapshot();
    expect(snap.charge).toBe("down");
    expect(snap.status).toBe("degraded");
  });

  it("treats a silent (timed-out) probe socket as down", async () => {
    stub(10, 10, 10);
    state.behaviors[REDIS] = { mode: "timeout" };
    const snap = await svc.snapshot();
    expect(snap.redis).toBe("down");
    expect(snap.status).toBe("degraded");
  }, 4000);

  it("ignores a late socket event once the probe has already settled", async () => {
    stub(10, 10, 10);
    state.behaviors[REDIS] = { mode: "data-then-error", data: "+PONG\r\n" };
    const snap = await svc.snapshot();
    // the first settle (the +PONG data) wins; the trailing error is a no-op
    expect(snap.redis).toBe("ok");
  });

  it("reports 0% memory when total memory reads as zero (defensive guard)", async () => {
    // only cpu + load are stubbed so the real memory() body runs and hits the guard
    vi.spyOn(svc as never, "cpu" as never).mockResolvedValue(10 as never);
    vi.spyOn(svc as never, "loadScore" as never).mockReturnValue(10 as never);
    state.os.totalmem = 0;
    const snap = await svc.snapshot();
    expect(snap.memoryPercent).toBe(0);
    expect(snap.memory).toBe("low");
  });

  it("treats a missing load-average sample as zero load", async () => {
    vi.spyOn(svc as never, "cpu" as never).mockResolvedValue(10 as never);
    vi.spyOn(svc as never, "memory" as never).mockResolvedValue(10 as never);
    state.os.loadavg = [];
    const snap = await svc.snapshot();
    expect(snap.loadScore).toBe(0);
    expect(snap.charge).toBe("low");
  });
});
