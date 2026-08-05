import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import type { SystemSnapshot } from "~/composables/useSystemMetrics";
import { SHIPPED_THRESHOLDS } from "~/utils/metrics";

// `onMounted(load)` is a deliberate no-op here (no component instance), so the
// tests that need the opening window call `load()` themselves.
const realWarn = console.warn;
vi.spyOn(console, "warn").mockImplementation((msg: unknown, ...rest: unknown[]) => {
  if (typeof msg === "string" && msg.includes("onMounted is called when there is no active component")) return;
  realWarn(msg, ...rest);
});

let call: ReturnType<typeof vi.fn>;
let frame: ReturnType<typeof ref<SystemSnapshot | null>>;
/** The clock the staleness is read against, driven here the way its interval would. */
let tickClock: () => void;

function snapshot(at: number, over: Partial<SystemSnapshot> = {}): SystemSnapshot {
  return {
    at,
    cores: 8,
    cpu: 10,
    load: { one: 1, five: 2, fifteen: 3 },
    memory: { total: 1000, used: 250 },
    network: { interface: "eth0", in: 100, out: 200 },
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  call = vi.fn().mockResolvedValue({ snapshot: null, points: [] });
  frame = ref<SystemSnapshot | null>(null);
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useRealtimeTopic", () => frame);
  vi.stubGlobal("useDataRefresh", () => ({ tick: ref(0), bump: vi.fn() }));
  tickClock = () => undefined;
  vi.stubGlobal("useIntervalFn", (fn: () => void) => {
    tickClock = fn;
  });
});
afterEach(() => vi.useRealTimers());

const { useSystemMetrics, pointOf } = await import("~/composables/useSystemMetrics");

describe("pointOf", () => {
  it("turns memory into the percentage the curve is drawn in", () => {
    expect(pointOf(snapshot(1))).toMatchObject({ memory: 25, load: [1, 2, 3], network: [100, 200] });
  });

  it("keeps a host with no reportable interface out of the network curve", () => {
    expect(pointOf(snapshot(1, { network: null })).network).toBeNull();
  });

  // The first frame of a connection carries no percentage: two readings of
  // /proc/stat are what makes one.
  it("keeps a cpu that is not known yet as a hole rather than a zero", () => {
    expect(pointOf(snapshot(1, { cpu: null })).cpu).toBeNull();
  });

  it("reports no memory at all rather than dividing by a total of zero", () => {
    expect(pointOf(snapshot(1, { memory: { total: 0, used: 0 } })).memory).toBe(0);
  });
});

describe("useSystemMetrics", () => {
  // The sampling loop has been running since boot, so the minute the page opens
  // on already exists: waiting for the socket to fill it would be a minute of
  // watching a line crawl in from the left.
  it("opens on the live minute the API already has", async () => {
    const points = [snapshot(1), snapshot(2)];
    call.mockResolvedValue({ snapshot: points[1], points });

    const metrics = useSystemMetrics();
    await metrics.load();
    expect(metrics.snapshot.value).toEqual(points[1]);

    expect(call).toHaveBeenCalledWith("/supervision/live");
    expect(metrics.history.value).toHaveLength(2);
    expect(metrics.status.value).toBe("live");
  });

  // The interface paints its red with the API's own thresholds: the machine
  // notifies on a red figure, and a second copy of the number is how a card and
  // a notification end up disagreeing about one host.
  it("takes the thresholds the live window carries", async () => {
    const metrics = useSystemMetrics();
    expect(metrics.thresholds.value).toEqual(SHIPPED_THRESHOLDS);

    call.mockResolvedValue({ snapshot: null, points: [], thresholds: { busy: 0.5, saturated: 0.8 } });
    await metrics.load();
    expect(metrics.thresholds.value).toEqual({ busy: 0.5, saturated: 0.8 });
  });

  it("keeps the ones it ships with when an older API carries none", async () => {
    call.mockResolvedValue({ snapshot: null, points: [] });
    const metrics = useSystemMetrics();
    await metrics.load();
    expect(metrics.thresholds.value).toEqual(SHIPPED_THRESHOLDS);
  });

  it("appends every frame the topic pushes", async () => {
    const metrics = useSystemMetrics();
    frame.value = snapshot(10);
    await nextTick();
    frame.value = snapshot(20);
    await nextTick();

    expect(metrics.history.value.map((point) => point.at)).toEqual([10, 20]);
    expect(metrics.snapshot.value?.at).toBe(20);
  });

  // The API window and the first pushed frame can be the same sample.
  it("never counts the same moment twice", async () => {
    call.mockResolvedValue({ snapshot: snapshot(10), points: [snapshot(10)] });
    const metrics = useSystemMetrics();
    await metrics.load();

    frame.value = snapshot(10);
    await nextTick();
    expect(metrics.history.value).toHaveLength(1);
  });

  // Sixty-one points at one a second is exactly the 60 s the axis says.
  it("holds the window to the minute the axis promises", async () => {
    const metrics = useSystemMetrics();
    for (let i = 1; i <= 80; i += 1) {
      frame.value = snapshot(i);
      await nextTick();
    }
    expect(metrics.history.value).toHaveLength(61);
    expect(metrics.history.value[0]?.at).toBe(20);
    expect(metrics.history.value[60]?.at).toBe(80);
  });

  it("says it is connecting while nothing has arrived yet", () => {
    expect(useSystemMetrics().status.value).toBe("connecting");
  });

  it("says it is offline once the first read came back with nothing to show", async () => {
    const metrics = useSystemMetrics();
    await metrics.load();
    expect(metrics.status.value).toBe("offline");
  });

  // A socket held open by a proxy in front of a server that stopped answering is
  // exactly the case a badge reading "live" must not survive.
  it("stops claiming to be live once the frames simply stop", async () => {
    const metrics = useSystemMetrics();
    frame.value = snapshot(10);
    await nextTick();
    expect(metrics.status.value).toBe("live");

    vi.setSystemTime(Date.now() + 9_000);
    tickClock();
    await nextTick();
    expect(metrics.status.value).toBe("offline");
  });

  // The figures are held, dimmed by the panel, rather than replaced by a
  // skeleton that flashes whenever the feed blinks.
  it("never goes back to connecting once figures are on screen", async () => {
    const metrics = useSystemMetrics();
    frame.value = snapshot(10);
    await nextTick();

    vi.setSystemTime(Date.now() + 60_000);
    tickClock();
    await nextTick();
    expect(metrics.status.value).not.toBe("connecting");
    expect(metrics.snapshot.value?.at).toBe(10);
  });

  it("survives a live window the API refuses to hand over", async () => {
    call.mockRejectedValue(new Error("403"));
    const metrics = useSystemMetrics();
    await metrics.load();
    expect(metrics.status.value).toBe("offline");
    expect(metrics.snapshot.value).toBeNull();
  });
});
