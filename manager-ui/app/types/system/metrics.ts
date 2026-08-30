// What the machine reports about itself: the live sample and the recorded
// windows the supervision charts draw.

export interface SystemSnapshot {
  /** Epoch milliseconds, read on the host that sampled it. */
  at: number;
  cores: number;
  cpu: number | null;
  load: { one: number; five: number; fifteen: number };
  memory: { total: number; used: number };
  network: { interface: string; in: number | null; out: number | null } | null;
}

// One point's worth of what the curves draw, as percentages except the load.
// Every figure can be null and each null means something different: a CPU that
// needs two readings and has had one, a network the host will not report, or, on
// the recorded windows, a moment nothing was written for. They are kept rather
// than dropped so that a point stays where its moment is.
export interface HistoryPoint {
  at: number;
  cpu: number | null;
  memory: number | null;
  load: [number, number, number] | null;
  /** Bytes per second, in then out. */
  network: [number, number] | null;
}

export type MetricsStatus = "connecting" | "live" | "offline";

export type MetricRange = "minute" | "hour" | "day" | "week";

export interface RetentionView {
  supervisionRetentionMs: number;
}

export interface Walking {
  /** The moments the points cover, newest last. */
  at: () => number[];
  count: () => number;
  /** Points still arriving, which is the only case there is anything to walk. */
  live: () => boolean;
  /** Reading a figure rather than watching the curve: the walk lands at once. */
  frozen: () => boolean;
}
