// The geometry and the graduation of a metric chart, kept out of the component
// so the component is the drawing and nothing else.

/** The plot is one size for every card: two boxes of different heights draw the
 *  same variation at two amplitudes, and the eye reads the taller as the busier
 *  machine. `padding` is room for the stroke, so a curve at the ceiling is not
 *  clipped in half. */
export const CHART = { width: 100, height: 40, padding: 3 };

export interface CurvePoint {
  /** Where it sits on the time axis, which is its place in the window. */
  index: number;
  value: number;
}

export interface CurveFragment {
  run: CurvePoint[];
  path: string;
}

export interface ChartScale {
  x: (index: number) => number;
  y: (value: number) => number;
}

export function metricChartScale(count: number, max: number) {
  const span = max > 0 ? max : 1;

  const scale: ChartScale = {
    x: (index) => (count > 1 ? (index / (count - 1)) * CHART.width : 0),
    y: (value) => CHART.height - CHART.padding - (Math.min(span, Math.max(0, value)) / span) * (CHART.height - CHART.padding * 2),
  };

  return scale;
}

// A curve is drawn in runs of consecutive points that exist. A window nothing
// was recorded in is not a value to interpolate through: joining across it would
// draw a machine that was never measured.
export function metricRuns(values: (number | null)[]) {
  const found: CurvePoint[][] = [];
  let run: CurvePoint[] = [];

  values.forEach((value, index) => {
    if (value === null) {
      if (run.length) found.push(run);
      run = [];
      return;
    }

    run.push({ index, value });
  });

  if (run.length) found.push(run);
  return found;
}

// Monotone cubic, not a plain spline: a Catmull-Rom through a spike overshoots,
// and an overshoot here draws a CPU below zero or a load higher than the one
// that was measured. The tangents are flattened at every turn, so the curve
// never leaves the interval its own points define.
export function metricCurve(run: CurvePoint[], scale: ChartScale) {
  const first = run[0] as CurvePoint;
  // A single point between two holes, drawn as a dot by the round cap: a reading
  // that exists and cannot be joined to anything is still a reading.
  if (run.length < 2) return `M${scale.x(first.index).toFixed(2)},${scale.y(first.value).toFixed(2)}l0,0`;

  const slopes = run.map((point, index) => {
    const previous = run[index - 1];
    const next = run[index + 1];

    if (!previous) return (next as CurvePoint).value - point.value;
    if (!next) return point.value - previous.value;

    const before = point.value - previous.value;
    const after = next.value - point.value;
    // A turning point gets a flat tangent, which is what keeps the curve inside.
    return before * after <= 0 ? 0 : (Math.sign(before) * Math.min(Math.abs(before), Math.abs(after)) * 3) / 2;
  });

  let path = `M${scale.x(first.index).toFixed(2)},${scale.y(first.value).toFixed(2)}`;
  for (let index = 1; index < run.length; index += 1) {
    const from = run[index - 1] as CurvePoint;
    const to = run[index] as CurvePoint;
    const step = (scale.x(to.index) - scale.x(from.index)) / 3;

    path +=
      ` C${(scale.x(from.index) + step).toFixed(2)},${scale.y(from.value + (slopes[index - 1] as number) / 3).toFixed(2)}` +
      ` ${(scale.x(to.index) - step).toFixed(2)},${scale.y(to.value - (slopes[index] as number) / 3).toFixed(2)}` +
      ` ${scale.x(to.index).toFixed(2)},${scale.y(to.value).toFixed(2)}`;
  }

  return path;
}

/** One list of fragments per curve: one fragment per unbroken run of points. */
export function metricPaths(series: (number | null)[][], scale: ChartScale) {
  return series.map((values) => metricRuns(values).map((run) => ({ run, path: metricCurve(run, scale) })));
}

// The fill is closed on the baseline under each fragment separately, so a hole
// in the curve is a hole in the wash under it too.
export function metricAreas(fragments: CurveFragment[], scale: ChartScale) {
  return fragments.map(({ run, path }) => {
    const from = scale.x((run[0] as CurvePoint).index).toFixed(2);
    const to = scale.x((run[run.length - 1] as CurvePoint).index).toFixed(2);
    return `${path} L${to},${CHART.height} L${from},${CHART.height} Z`;
  });
}

// The x axis carries clock times, not distances from now: "2 h 15 ago" is a
// subtraction left to the reader, and the answer they want is the one on their
// own clock, because a peak is something to line up against a deploy or a
// backup. The marks stand on round moments of the reader's own day, which is
// what makes them stay still while the curve moves under them.
const AXIS = [
  { upTo: 120_000, every: 15_000, seconds: true, date: false },
  { upTo: 7_200_000, every: 900_000, seconds: false, date: false },
  { upTo: 172_800_000, every: 21_600_000, seconds: false, date: false },
  { upTo: Number.POSITIVE_INFINITY, every: 86_400_000, seconds: false, date: true },
];

export type AxisScale = (typeof AXIS)[number];

export interface AxisWindow {
  from: number;
  to: number;
  scale: AxisScale;
}

/** The two ends of what is drawn, and how finely the times on it are written. */
export function axisWindow(at: number[]) {
  const from = at[0];
  const to = at[at.length - 1];
  if (from === undefined || to === undefined || to <= from) return null;

  const scale = AXIS.find((entry) => to - from <= entry.upTo) ?? (AXIS[AXIS.length - 1] as AxisScale);
  const window: AxisWindow = { from, to, scale };
  return window;
}

// Everything is epoch milliseconds until here, where the browser turns them into
// the reader's own zone. Nothing on the way, not the host, not the database, not
// the API, has to know which zone that is, which is why nothing gets to be wrong
// about it.
export function axisClock(moment: number, tag: string, scale: AxisScale, precise = false) {
  const date = new Date(moment);
  const time = date.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
    ...(scale.seconds || (precise && !scale.date) ? { second: "2-digit" } : {}),
  });

  if (!scale.date) return time;

  const day = date.toLocaleDateString(tag, { day: "2-digit", month: "2-digit" });
  return precise ? `${day} ${time}` : day;
}

// The alignment takes the zone off before the division and puts it back after:
// aligning on the epoch would stand a day mark at two in the morning for anybody
// two hours ahead of UTC.
export function axisTicks(window: AxisWindow | null, tag: string) {
  if (!window) return [];

  const { from, to, scale } = window;
  const shift = -new Date(to).getTimezoneOffset() * 60_000;

  const marks: { at: number; label: string }[] = [];
  for (let mark = Math.floor((to + shift) / scale.every) * scale.every - shift; mark > from; mark -= scale.every) {
    const position = ((mark - from) / (to - from)) * 100;
    if (position < 4 || position > 96) continue;

    marks.push({ at: position, label: axisClock(mark, tag, scale) });
  }

  return marks;
}
