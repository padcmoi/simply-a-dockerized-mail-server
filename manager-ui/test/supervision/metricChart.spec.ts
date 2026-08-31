import { describe, it, expect } from "vitest";
import {
  CHART,
  axisClock,
  axisTicks,
  axisWindow,
  metricAreas,
  metricChartScale,
  metricPaths,
  metricRuns,
} from "~/utils/metricChart";

describe("metricChartScale", () => {
  it("spreads the points over the full width, first on the left edge and last on the right", () => {
    const scale = metricChartScale(3, 100);
    expect(scale.x(0)).toBe(0);
    expect(scale.x(2)).toBe(CHART.width);
  });

  // What makes a live plot able to walk: the newest sample is laid out one step
  // past the right edge, and the walk brings it in over the sampling interval.
  it("lays the curve out wider than its box when asked, one step past the edge", () => {
    const count = 61;
    const step = CHART.width / (count - 2);
    const scale = metricChartScale(count, 100, CHART.width + step);
    expect(scale.x(count - 1)).toBeCloseTo(CHART.width + step, 6);
    expect(scale.x(count - 1) - step).toBeCloseTo(CHART.width, 6);
    // And point 1 lands on the left edge once that step has been walked.
    expect(scale.x(1) - step).toBeCloseTo(0, 6);
  });

  it("stands a single point on the left rather than dividing by zero", () => {
    expect(metricChartScale(1, 100).x(0)).toBe(0);
  });

  it("draws the ceiling at the top of the box and zero on the baseline", () => {
    const scale = metricChartScale(2, 100);
    expect(scale.y(100)).toBe(CHART.padding);
    expect(scale.y(0)).toBe(CHART.height - CHART.padding);
  });

  it("clamps a value past the ceiling rather than drawing outside the box", () => {
    const scale = metricChartScale(2, 100);
    expect(scale.y(150)).toBe(scale.y(100));
    expect(scale.y(-5)).toBe(scale.y(0));
  });

  it("keeps a flat line on the floor when the whole window is zero", () => {
    const scale = metricChartScale(2, 0);
    expect(scale.y(0)).toBe(CHART.height - CHART.padding);
  });
});

describe("metricRuns", () => {
  // A window nothing was recorded in is not a value to interpolate through:
  // joining across it would draw a machine that was never measured.
  it("cuts the curve at every hole rather than joining across it", () => {
    expect(metricRuns([1, 2, null, 3, 4])).toEqual([
      [
        { index: 0, value: 1 },
        { index: 1, value: 2 },
      ],
      [
        { index: 3, value: 3 },
        { index: 4, value: 4 },
      ],
    ]);
  });

  it("keeps a lone reading between two holes, because it is still a reading", () => {
    expect(metricRuns([null, 5, null])).toEqual([[{ index: 1, value: 5 }]]);
  });

  it("has nothing to draw for a window with no figure at all", () => {
    expect(metricRuns([null, null])).toEqual([]);
  });
});

describe("metricPaths", () => {
  const scale = metricChartScale(4, 100);

  it("draws one fragment per unbroken run", () => {
    const [curve] = metricPaths([[1, 2, null, 4]], scale);
    expect(curve).toHaveLength(2);
  });

  // A Catmull-Rom through a spike overshoots, and an overshoot here draws a CPU
  // below zero or a load higher than the one that was measured.
  it("never leaves the box its own points define, spike or not", () => {
    const [curve] = metricPaths([[0, 100, 0, 0]], scale);
    const numbers = (curve?.[0]?.path.match(/-?\d+\.\d+/g) ?? []).map(Number);
    const ys = numbers.filter((_, index) => index % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(CHART.padding);
    expect(Math.max(...ys)).toBeLessThanOrEqual(CHART.height - CHART.padding);
  });

  it("draws a lone point as a dot the round cap can render", () => {
    const [curve] = metricPaths([[null, 5, null]], scale);
    expect(curve?.[0]?.path).toContain("l0,0");
  });
});

describe("metricAreas", () => {
  it("closes the fill on the baseline under each fragment, so a hole stays a hole", () => {
    const scale = metricChartScale(4, 100);
    const [curve] = metricPaths([[1, 2, null, 4]], scale);
    const areas = metricAreas(curve ?? [], scale);
    expect(areas).toHaveLength(2);
    for (const area of areas) expect(area.endsWith("Z")).toBe(true);
  });
});

describe("axisWindow", () => {
  it("has no window to write when there are not two moments to write it from", () => {
    expect(axisWindow([])).toBeNull();
    expect(axisWindow([1])).toBeNull();
  });

  it("writes the seconds on a minute-wide window and drops them on an hour", () => {
    const minute = axisWindow([0, 60_000]);
    const hour = axisWindow([0, 3_600_000]);
    expect(minute?.scale.seconds).toBe(true);
    expect(hour?.scale.seconds).toBe(false);
  });

  it("writes dates rather than clock times once the window is wider than two days", () => {
    expect(axisWindow([0, 604_800_000])?.scale.date).toBe(true);
  });
});

describe("axisTicks", () => {
  it("has nothing to graduate without a window", () => {
    expect(axisTicks(null, "en-GB")).toEqual([]);
  });

  // Marks on round moments of the reader's own day: that is what keeps them
  // still while the curve moves under them.
  it("stands its marks on round moments of the window, inside the plot", () => {
    const to = 1_800_000_000_000;
    const marks = axisTicks(axisWindow([to - 60_000, to]), "en-GB");
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(mark.at).toBeGreaterThanOrEqual(0);
      expect(mark.at).toBeLessThanOrEqual(100);
    }
  });

  // Dropping a mark for standing near an end is what made one vanish mid-plot
  // on a chart that walks. The ends are masked by their own labels instead.
  it("keeps the marks that reach the ends rather than making them disappear", () => {
    const to = 1_800_000_000_000;
    const window = axisWindow([to - 60_000, to]);
    const every = 15_000;
    const expected = Math.floor((to - (to - 60_000)) / every);
    expect(axisTicks(window, "en-GB").length).toBeGreaterThanOrEqual(expected - 1);
  });
});

describe("axisTicks on a walking chart", () => {
  // The marks are laid out over the same width the curve is, so a graduation
  // and the moment of the curve it names travel together instead of the times
  // jumping every second while the line glides.
  it("places its marks over the wider layout, past the box's own edge", () => {
    const to = 1_800_000_000_000;
    const window = axisWindow([to - 60_000, to]);
    const stride = 100 / 59;

    const still = axisTicks(window, "en-GB", 100);
    const walking = axisTicks(window, "en-GB", 100 + stride);

    expect(walking).toHaveLength(still.length);
    walking.forEach((mark, index) => {
      const same = still[index];
      expect(mark.label).toBe(same?.label);
      // Where it will sit once the walk has carried it its one step left.
      expect(mark.at - stride).toBeCloseTo((same?.at ?? 0) * (1 + stride / 100) - stride, 6);
    });
  });

  // The newest mark starts just off the right edge and is carried in, the oldest
  // is carried out on the left: neither pops into existence inside the plot.
  it("lets a mark start off the box and walk into it", () => {
    const to = 1_800_000_000_000;
    const stride = 100 / 59;
    const marks = axisTicks(axisWindow([to - 60_000, to]), "en-GB", 100 + stride);
    for (const mark of marks) {
      expect(mark.at).toBeGreaterThanOrEqual(0);
      expect(mark.at - stride).toBeLessThanOrEqual(100);
    }
  });
});

describe("axisClock", () => {
  const scale = { upTo: 120_000, every: 15_000, seconds: true, date: false };

  it("writes the moment in the reader's own zone, from the epoch it arrived as", () => {
    const at = Date.UTC(2026, 0, 2, 3, 4, 5);
    const written = axisClock(at, "en-GB", scale);
    const expected = new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    expect(written).toBe(expected);
  });

  // The pointer is the precise instrument: it carries the day where the axis
  // carries only the date.
  it("adds the day to the pointer's reading on a window written in dates", () => {
    const wide = { upTo: Number.POSITIVE_INFINITY, every: 86_400_000, seconds: false, date: true };
    const at = Date.UTC(2026, 0, 2, 3, 4, 5);
    expect(axisClock(at, "en-GB", wide, true).split(" ")).toHaveLength(2);
    expect(axisClock(at, "en-GB", wide).split(" ")).toHaveLength(1);
  });
});
