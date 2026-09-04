// What the machine reports about itself: the live sample and the recorded
// windows the supervision charts draw.

// rspamd's own counters, the ones its page tiles, each counted since rspamd
// started.
export interface RspamdCounters {
  scanned: number;
  noAction: number;
  greylist: number;
  addHeader: number;
  reject: number;
  learned: number;
}

export interface SystemSnapshot {
  /** Epoch milliseconds, read on the host that sampled it. */
  at: number;
  cores: number;
  cpu: number | null;
  load: { one: number; five: number; fifteen: number };
  memory: { total: number; used: number };
  network: { interface: string; in: number | null; out: number | null } | null;
  /** rspamd's counters at that moment; null while rspamd is out of reach. */
  rspamd: RspamdCounters | null;
  /** Messages waiting in each Postfix queue directory; null while the spool is out of reach. */
  postfix: QueueDirStats | null;
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
  /** rspamd's counters at the point: scanned, no action, greylist, add header, reject, learned. */
  rspamd: [number, number, number, number, number, number] | null;
  /** Queue depths at the point: active, deferred, hold, incoming. */
  postfix: [number, number, number, number] | null;
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
