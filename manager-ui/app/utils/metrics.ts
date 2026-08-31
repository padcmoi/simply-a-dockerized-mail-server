// What the four machine cards share: how a box is scaled, when a figure counts
// as raised, and how a value is written. Here rather than in one of them,
// because a card that scales differently from its neighbour cannot be compared
// to it.

// Per core, which is the only way a load average means anything: 4 is idle on an
// eight-thread host and desperate on a single-core one. The same thresholds
// serve the memory and the CPU, so one colour means one thing across the cards.
//
// These are what the interface ships with. The API serves its own with the live
// window (`thresholds`), and those are the ones a card is painted with as soon
// as it answers: the machine notifies on a red figure, and a second copy of the
// number is how a card and a notification end up disagreeing about one host.
export const BUSY = 0.7;
export const SATURATED = 0.9;

export interface MetricThresholds {
  busy: number;
  saturated: number;
}

export const SHIPPED_THRESHOLDS: MetricThresholds = { busy: BUSY, saturated: SATURATED };

// The outline is written with `!`: the card ships its own `ring-default` and the
// two are the same utility, so which one survives would otherwise depend on the
// order the stylesheet happens to emit them in.
const ALERT = {
  busy: { color: "warning" as const, ring: "ring-warning!" },
  saturated: { color: "error" as const, ring: "ring-error!" },
};

export type MetricAlert = (typeof ALERT)[keyof typeof ALERT];

/** Null below the busy threshold: an outline that is always on says nothing. */
export function metricAlert(ratio: number | null, thresholds: MetricThresholds = SHIPPED_THRESHOLDS) {
  const alert: MetricAlert | null =
    ratio === null || ratio < thresholds.busy ? null : ratio >= thresholds.saturated ? ALERT.saturated : ALERT.busy;
  return alert;
}

// Nulls are moments with no figure, and they are skipped everywhere a figure is
// wanted rather than counted as zero, which would drag every scale down to a
// floor the host never touched.
function known(values: (number | null)[]) {
  return values.flatMap((value) => (value === null ? [] : [value]));
}

/** How many points of a window can be drawn. Under two there is no curve. */
export function metricKnown(values: (number | null)[]) {
  return known(values).length;
}

// Every box is fitted to its own window rather than to a nominal full scale: a
// CPU at 2 % drawn against 100 % is a flat line on the floor, and 200 kb/s of a
// 2 Gb/s link is nothing at all. The floor keeps an idle machine from having its
// own noise magnified to fill the box, and the fifth of headroom keeps the curve
// off the ceiling.
export function metricCeiling(values: (number | null)[], floor: number) {
  return Math.max(Math.max(...known(values), 0) * 1.2, floor);
}

// Bits, because a link is sold and read in bits, while /proc counts the bytes
// that went through it.
export function bitsPerSecond(bytes: number) {
  const units = ["b/s", "kb/s", "Mb/s", "Gb/s"];
  let size = bytes * 8;
  let unit = 0;

  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }

  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

// One decimal, always, whatever the scale: 24 616 660 992 bytes is 24.6 GB, and
// rounding it to 25 GB makes the card argue with the invoice.
export function preciseBytes(bytes: number) {
  const units = ["B", "kB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }

  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`;
}
