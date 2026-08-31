import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import { CHART } from "~/utils/metricChart";

// The two frames the walk waits for before starting again, driven here rather
// than by a browser: the first paints the reset, the second starts the walk.
let frames: (() => void)[] = [];

function paint() {
  const pending = frames;
  frames = [];
  for (const frame of pending) frame();
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
    frames.push(fn);
    return frames.length;
  });
  // Restored here rather than through unstubAllGlobals, which would take the
  // reactivity globals test/setup.ts installs down with it.
  vi.stubGlobal("useMediaQuery", () => ref(false));
});

const { useMetricWalk } = await import("~/composables/useMetricWalk");

function window(seconds: number, cadence = 1000) {
  return Array.from({ length: seconds }, (_, index) => 1_800_000_000_000 + index * cadence);
}

function build(over: Partial<{ live: boolean; frozen: boolean }> = {}) {
  const at = ref(window(61));
  const frozen = ref(over.frozen ?? false);
  const live = ref(over.live ?? true);
  const walk = useMetricWalk({
    at: () => at.value,
    count: () => at.value.length,
    live: () => live.value,
    frozen: () => frozen.value,
  });
  return { at, frozen, live, ...walk };
}

async function arrive(at: ReturnType<typeof build>["at"]) {
  const last = at.value[at.value.length - 1] as number;
  at.value = [...at.value.slice(1), last + 1000];
  await nextTick();
}

describe("useMetricWalk", () => {
  it("walks a live chart by exactly one sample of its own width", () => {
    const walk = build();
    expect(walk.walks.value).toBe(true);
    expect(walk.step.value).toBeCloseTo(CHART.width / 59, 6);
    expect(walk.stride.value).toBeCloseTo(100 / 59, 6);
  });

  // The recorded windows are redrawn every minute at the earliest: there is
  // nothing arriving to follow, and a curve creeping for a minute is a distraction.
  it("does not walk a window whose points are not arriving", () => {
    const walk = build({ live: false });
    expect(walk.walks.value).toBe(false);
    expect(walk.step.value).toBe(0);
    expect(walk.curve.value.transform).toBe("translateX(0px)");
  });

  it("does not walk a window whose samples are minutes apart", () => {
    const at = ref(window(61, 60_000));
    const walk = useMetricWalk({ at: () => at.value, count: () => at.value.length, live: () => true, frozen: () => false });
    expect(walk.walks.value).toBe(false);
  });

  it("rests one step to the left, which is where the newest sample is on the edge", () => {
    const walk = build();
    expect(walk.curve.value.transform).toBe(`translateX(${-CHART.width / 59}px)`);
    expect(walk.labels.value.transform).toBe(`translateX(${-100 / 59}%)`);
    expect(walk.curve.value.transition).toBe("none");
  });

  // The reset happens on the frame the new point is drawn, at the position the
  // walk had just reached, so there is nothing to see at the seam.
  it("returns to its start without a transition when a sample lands", async () => {
    const walk = build();
    await arrive(walk.at);

    expect(walk.curve.value.transform).toBe("translateX(0px)");
    expect(walk.labels.value.transform).toBe("translateX(0%)");
    expect(walk.curve.value.transition).toBe("none");
  });

  it("then walks the whole step over the interval the samples arrive at", async () => {
    const walk = build();
    await arrive(walk.at);
    paint();
    paint();
    await nextTick();

    expect(walk.curve.value.transform).toBe(`translateX(${-CHART.width / 59}px)`);
    expect(walk.curve.value.transition).toBe("transform 1000ms linear");
    expect(walk.labels.value.transition).toBe("transform 1000ms linear");
  });

  // Reading a figure is not watching a curve: the crosshair must mark where the
  // point actually is, not where it is passing through.
  it("lands at once, without walking, while the pointer is on the plot", async () => {
    const walk = build({ frozen: true });
    await arrive(walk.at);

    expect(walk.curve.value.transform).toBe(`translateX(${-CHART.width / 59}px)`);
    expect(walk.curve.value.transition).toBe("none");
    expect(frames).toHaveLength(0);
  });

  it("stops walking if the pointer arrives between the reset and the walk", async () => {
    const walk = build();
    await arrive(walk.at);
    walk.frozen.value = true;
    paint();
    paint();
    await nextTick();

    expect(walk.curve.value.transition).toBe("none");
    expect(walk.curve.value.transform).toBe(`translateX(${-CHART.width / 59}px)`);
  });

  it("stands still for an account that asked for less motion", async () => {
    vi.stubGlobal("useMediaQuery", () => ref(true));
    const walk = build();
    expect(walk.walks.value).toBe(false);
    await arrive(walk.at);
    expect(walk.curve.value.transition).toBe("none");
  });
});
