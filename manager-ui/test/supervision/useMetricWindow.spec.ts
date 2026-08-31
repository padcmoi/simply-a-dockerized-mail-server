import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import type { HistoryPoint, MetricRange } from "~/types/system/metrics";

// `onMounted(load)` is a deliberate no-op here (no component instance): every
// load below is the one the range switch triggers.
const realWarn = console.warn;
vi.spyOn(console, "warn").mockImplementation((msg: unknown, ...rest: unknown[]) => {
  if (typeof msg === "string" && msg.includes("onMounted is called when there is no active component")) return;
  realWarn(msg, ...rest);
});

let call: ReturnType<typeof vi.fn>;

function point(at: number): HistoryPoint {
  return { at, cpu: 1, memory: 2, load: [1, 2, 3], network: [4, 5] };
}

beforeEach(() => {
  vi.useFakeTimers();
  call = vi.fn().mockResolvedValue({ points: [point(1), point(2)] });
  vi.stubGlobal("useApi", () => ({ call }));
});
afterEach(() => vi.useRealTimers());

const { useMetricWindow } = await import("~/composables/useMetricWindow");

describe("useMetricWindow", () => {
  // The live minute is the socket's own history: nothing else is that fresh.
  it("draws the minute from the live feed and asks the API for nothing", async () => {
    const range = ref<MetricRange>("minute");
    const window = useMetricWindow(range, () => [point(9)]);
    await nextTick();

    expect(call).not.toHaveBeenCalled();
    expect(window.points.value).toEqual([point(9)]);
    expect(window.at.value).toEqual([9]);
  });

  it("reads a longer window from the recorded samples", async () => {
    const range = ref<MetricRange>("minute");
    const window = useMetricWindow(range, () => []);
    range.value = "hour";
    await vi.waitFor(() => expect(window.points.value).toHaveLength(2));

    expect(call).toHaveBeenCalledWith("/supervision/history/hour");
    expect(window.at.value).toEqual([1, 2]);
  });

  it("drops what it held before asking for another window", async () => {
    const range = ref<MetricRange>("minute");
    const window = useMetricWindow(range, () => []);
    range.value = "hour";
    await vi.waitFor(() => expect(window.points.value).toHaveLength(2));

    call.mockReturnValue(new Promise(() => undefined));
    range.value = "day";
    await nextTick();
    expect(window.points.value).toEqual([]);
  });

  // The answer to a question nobody is asking any more must not land on the card.
  it("ignores an answer whose window was left while it was in flight", async () => {
    const range = ref<MetricRange>("minute");
    const window = useMetricWindow(range, () => []);

    let settle: (value: unknown) => void = () => undefined;
    call.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    range.value = "hour";
    await nextTick();

    call.mockResolvedValue({ points: [point(7)] });
    range.value = "day";
    await vi.waitFor(() => expect(window.points.value).toEqual([point(7)]));

    settle({ points: [point(1), point(2)] });
    await nextTick();
    expect(window.points.value).toEqual([point(7)]);
  });

  // Never a dash: a window still loading, one nothing was recorded in and one
  // that cannot be read are three different things a reader reacts to differently.
  it("says which of the three reasons there is no curve to draw", async () => {
    const range = ref<MetricRange>("minute");
    const window = useMetricWindow(range, () => []);
    expect(window.notice.value).toBe("supervision.sampling");

    call.mockReturnValue(new Promise(() => undefined));
    range.value = "hour";
    await nextTick();
    expect(window.notice.value).toBe("supervision.rangeLoading");

    call.mockRejectedValue(new Error("nope"));
    range.value = "day";
    await vi.waitFor(() => expect(window.notice.value).toBe("supervision.rangeFailed"));

    call.mockResolvedValue({ points: [] });
    range.value = "week";
    await vi.waitFor(() => expect(window.notice.value).toBe("supervision.rangeEmpty"));
  });

  // A request a minute on an hour drawn in minutes is exactly one new column.
  it("asks a recorded window again at the width of one of its own points", async () => {
    const range = ref<MetricRange>("minute");
    useMetricWindow(range, () => []);
    range.value = "hour";
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(call).toHaveBeenCalledTimes(2);
  });

  // The pause holds the drawing, not the feed: what arrived under it is on
  // screen the moment it is lifted, rather than a hole where the paused
  // seconds were.
  it("holds the curve where it was and gives back the whole feed on release", async () => {
    const range = ref<MetricRange>("minute");
    const feed = ref<HistoryPoint[]>([point(1)]);
    const paused = ref(false);
    const window = useMetricWindow(range, () => feed.value, paused);

    paused.value = true;
    await nextTick();
    feed.value = [point(1), point(2)];
    await nextTick();
    expect(window.points.value).toEqual([point(1)]);
    expect(window.at.value).toEqual([1]);

    paused.value = false;
    await nextTick();
    expect(window.points.value).toEqual([point(1), point(2)]);
  });

  // Another window is another set of points entirely, so the pause cannot go on
  // showing the minute that was on screen under the axis of an hour.
  it("holds the window asked for under the pause, not the one it was pressed on", async () => {
    const range = ref<MetricRange>("minute");
    const paused = ref(true);
    const window = useMetricWindow(range, () => [point(9)], paused);
    await nextTick();
    expect(window.points.value).toEqual([point(9)]);

    range.value = "hour";
    await vi.waitFor(() => expect(window.points.value).toEqual([point(1), point(2)]));

    call.mockResolvedValue({ points: [point(3), point(4)] });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(window.points.value).toEqual([point(1), point(2)]);
  });

  it("stops asking once the card is back on the live minute", async () => {
    const range = ref<MetricRange>("minute");
    useMetricWindow(range, () => []);
    range.value = "hour";
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(1));

    range.value = "minute";
    await nextTick();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
