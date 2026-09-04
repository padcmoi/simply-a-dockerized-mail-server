import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

export const METRIC_RANGES = {
  hour: { span: 3_600_000, step: 60_000 },
  day: { span: 86_400_000, step: 900_000 },
  week: { span: 604_800_000, step: 7_200_000 },
} as const;

export type MetricRange = keyof typeof METRIC_RANGES;

export interface MetricPoint {
  at: number;
  cpu: number | null;
  /** Percent of what is installed, like the live frames, so one scale serves both. */
  memory: number | null;
  load: [number, number, number] | null;
  /** Bytes per second, in then out. */
  network: [number, number] | null;
  /** rspamd's counters at the end of the bucket: scanned, no action, greylist, add header, reject, learned. */
  rspamd: [number, number, number, number, number, number] | null;
  /** Mean depth of each Postfix queue over the bucket: active, deferred, hold, incoming. */
  postfix: [number, number, number, number] | null;
}

type Figure = number | string | null;

interface Bucket {
  at: number | string;
  cpu: number | null;
  load1: number;
  load5: number;
  load15: number;
  memory_used: number;
  memory_total: number;
  net_in: number | null;
  net_out: number | null;
  rspamd_scanned: Figure;
  rspamd_no_action: Figure;
  rspamd_greylist: Figure;
  rspamd_add_header: Figure;
  rspamd_reject: Figure;
  rspamd_learned: Figure;
  postfix_active: Figure;
  postfix_deferred: Figure;
  postfix_hold: Figure;
  postfix_incoming: Figure;
}

// A week holds around sixty thousand rows and a chart holds eighty-four columns
// of pixels, so the grouping happens in SQL over the index and never by handing
// a week of samples to javascript. rspamd's counters only climb, so a bucket
// keeps the highest it saw, which is where they stood at its end; the queues
// are averaged, a depth being a level and not a count.
const QUERY = `
  SELECT FLOOR(at / ?) * ? AS at,
         AVG(cpu) AS cpu,
         AVG(load_1) AS load1,
         AVG(load_5) AS load5,
         AVG(load_15) AS load15,
         AVG(memory_used) AS memory_used,
         MAX(memory_total) AS memory_total,
         AVG(net_in) AS net_in,
         AVG(net_out) AS net_out,
         MAX(rspamd_scanned) AS rspamd_scanned,
         MAX(rspamd_no_action) AS rspamd_no_action,
         MAX(rspamd_greylist) AS rspamd_greylist,
         MAX(rspamd_add_header) AS rspamd_add_header,
         MAX(rspamd_reject) AS rspamd_reject,
         MAX(rspamd_learned) AS rspamd_learned,
         AVG(postfix_active) AS postfix_active,
         AVG(postfix_deferred) AS postfix_deferred,
         AVG(postfix_hold) AS postfix_hold,
         AVG(postfix_incoming) AS postfix_incoming
    FROM metrics_history
   WHERE at >= ?
GROUP BY 1
ORDER BY 1
`;

// A service's figures stand or fall together: one of them missing is the
// service out of reach for the bucket, and a point with half a service is a
// curve drawn through a moment nobody measured.
function together<N extends number[]>(...values: Figure[]) {
  if (values.some((value) => value === null)) return null;
  return values.map(Number) as N;
}

@Injectable()
export class SupervisionHistoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async read(range: MetricRange) {
    const window = METRIC_RANGES[range];
    const now = Date.now();
    const since = now - window.span;

    const rows = (await this.dataSource.query(QUERY, [window.step, window.step, since])) as Bucket[];
    const recorded = new Map(rows.map((row) => [Number(row.at), row]));

    // The grid is built from the window and not from what came back, so a point
    // is always where its moment is. Every bucket is sent, including the ones
    // nothing was recorded in: dropping them would stretch twenty minutes of
    // samples across a box whose axis says 24 h.
    const first = Math.floor(since / window.step) * window.step;
    const count = Math.floor((now - first) / window.step) + 1;

    const points = Array.from({ length: count }, (_, index): MetricPoint => {
      const at = first + index * window.step;
      const row = recorded.get(at);
      if (!row) return { at, cpu: null, load: null, memory: null, network: null, rspamd: null, postfix: null };

      const total = Number(row.memory_total);
      return {
        at,
        cpu: row.cpu === null ? null : Number(row.cpu),
        load: [Number(row.load1), Number(row.load5), Number(row.load15)],
        memory: total > 0 ? (Number(row.memory_used) / total) * 100 : 0,
        network: row.net_in === null || row.net_out === null ? null : [Number(row.net_in), Number(row.net_out)],
        rspamd: together<[number, number, number, number, number, number]>(
          row.rspamd_scanned,
          row.rspamd_no_action,
          row.rspamd_greylist,
          row.rspamd_add_header,
          row.rspamd_reject,
          row.rspamd_learned
        ),
        postfix: together<[number, number, number, number]>(
          row.postfix_active,
          row.postfix_deferred,
          row.postfix_hold,
          row.postfix_incoming
        ),
      };
    });

    return { range, step: window.step, points };
  }
}
