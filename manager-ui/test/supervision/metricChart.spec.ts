import { describe, it, expect } from "vitest";
import { CHART, axisClock, axisTicks, axisWindow, metricAreas, metricChartScale, metricPaths, metricRuns } from "~/utils/metricChart";

describe("metricChartScale", () => {
  it("spreads the points over the full width, first on the left edge and last on the right", () => {
    const scale = metricChartScale(3, 100);
    expect(scale.x(0)).toBe(0);
    expect(scale.x(2)).toBe(CHART.width);
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
  it("stands its marks on round moments, inside the plot and never on its edges", () => {
    const to = 1_800_000_000_000;
    const marks = axisTicks(axisWindow([to - 60_000, to]), "en-GB");
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(mark.at).toBeGreaterThanOrEqual(4);
      expect(mark.at).toBeLessThanOrEqual(96);
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
