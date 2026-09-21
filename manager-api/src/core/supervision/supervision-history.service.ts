import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { WRITE_MS } from "./supervision-recorder.service";

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
  /** Bytes, used then total. */
  disk: [number, number] | null;
  /** Bytes per second, in then out. */
  network: [number, number] | null;
  /** rspamd's counters at the end of the bucket: scanned, no action, greylist, add header, reject, learned. */
  rspamd: [number, number, number, number, number, number] | null;
  /** Deepest each Postfix queue was over the bucket: active, deferred, hold, incoming. */
  postfix: [number, number, number, number] | null;
  /** Most addresses each fail2ban jail held banned at once over the bucket. */
  fail2ban: Record<string, number> | null;
  /** Oldest the newest signature database was over the bucket, in seconds. */
  clamavAge: number | null;
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
  disk_used: number | null;
  disk_total: number | null;
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
  clamav_age: Figure;
}

// A week holds around sixty thousand rows and a chart holds eighty-four columns
// of pixels, so the grouping happens in SQL over the index and never by handing
// a week of samples to javascript. Every bucket keeps the highest it saw rather
// than its mean: one column of the day window covers fifteen minutes, which is
// ninety rows, and a minute of load at 16 averaged against eighty-four minutes
// of an idle host is a night the chart says nothing happened on, while the
// notification sent at the time says otherwise. The peak is a moment the machine
// really had, the mean is a moment it never had.
const QUERY = `
  SELECT FLOOR(at / ?) * ? AS at,
         MAX(cpu) AS cpu,
         MAX(load_1) AS load1,
         MAX(load_5) AS load5,
         MAX(load_15) AS load15,
         MAX(memory_used) AS memory_used,
         MAX(memory_total) AS memory_total,
         MAX(disk_used) AS disk_used,
         MAX(disk_total) AS disk_total,
         MAX(net_in) AS net_in,
         MAX(net_out) AS net_out,
         MAX(rspamd_scanned) AS rspamd_scanned,
         MAX(rspamd_no_action) AS rspamd_no_action,
         MAX(rspamd_greylist) AS rspamd_greylist,
         MAX(rspamd_add_header) AS rspamd_add_header,
         MAX(rspamd_reject) AS rspamd_reject,
         MAX(rspamd_learned) AS rspamd_learned,
         ROUND(SUM(postfix_active) * ${WRITE_MS / 1000}) AS postfix_active,
         ROUND(SUM(postfix_deferred) * ${WRITE_MS / 1000}) AS postfix_deferred,
         ROUND(SUM(postfix_hold) * ${WRITE_MS / 1000}) AS postfix_hold,
         ROUND(SUM(postfix_incoming) * ${WRITE_MS / 1000}) AS postfix_incoming,
         MAX(clamav_age) AS clamav_age
    FROM metrics_history
   WHERE at >= ?
GROUP BY 1
ORDER BY 1
`;

const BANS_QUERY = `
  SELECT FLOOR(at / ?) * ? AS at, jail, MAX(banned) AS banned
    FROM fail2ban_history
   WHERE at >= ?
GROUP BY 1, jail
ORDER BY 1
`;

interface BanBucket {
  at: number | string;
  jail: string;
  banned: number | string;
}

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

    const [rows, banRows] = (await Promise.all([
      this.dataSource.query(QUERY, [window.step, window.step, since]),
      this.dataSource.query(BANS_QUERY, [window.step, window.step, since]),
    ])) as [Bucket[], BanBucket[]];
    const recorded = new Map(rows.map((row) => [Number(row.at), row]));
    const bans = new Map<number, Record<string, number>>();
    for (const row of banRows) {
      const at = Number(row.at);
      bans.set(at, { ...bans.get(at), [row.jail]: Number(row.banned) });
    }

    // The grid is built from the window and not from what came back, so a point
    // is always where its moment is. Every bucket is sent, including the ones
    // nothing was recorded in: dropping them would stretch twenty minutes of
    // samples across a box whose axis says 24 h.
    const first = Math.floor(since / window.step) * window.step;
    const count = Math.floor((now - first) / window.step) + 1;

    const points = Array.from({ length: count }, (_, index): MetricPoint => {
      const at = first + index * window.step;
      const row = recorded.get(at);
      const fail2ban = bans.get(at) ?? null;
      if (!row)
        return {
          at,
          cpu: null,
          load: null,
          memory: null,
          disk: null,
          network: null,
          rspamd: null,
          postfix: null,
          fail2ban,
          clamavAge: null,
        };

      const total = Number(row.memory_total);
      return {
        at,
        cpu: row.cpu === null ? null : Number(row.cpu),
        load: [Number(row.load1), Number(row.load5), Number(row.load15)],
        memory: total > 0 ? (Number(row.memory_used) / total) * 100 : 0,
        disk: row.disk_used === null || row.disk_total === null ? null : [Number(row.disk_used), Number(row.disk_total)],
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
        fail2ban,
        clamavAge: row.clamav_age === null ? null : Number(row.clamav_age),
      };
    });

    // The bucket the window is asked for on has just opened and holds nothing
    // yet, which the chart would draw as a hole the width of a column at the
    // right edge: a machine that stopped answering rather than a minute that has
    // not finished. It is dropped, and the curve ends on the last moment that
    // was measured. Only that one, and only when something was recorded
    // elsewhere in the window: a hole further back is a hole nothing was
    // measured in, and a window with nothing at all keeps its whole grid so the
    // axis still says how long it covers.
    const open = points[points.length - 1];
    if (points.length > 1 && open && nothing(open) && (recorded.size > 0 || bans.size > 0)) points.pop();

    return { range, step: window.step, points };
  }
}

function nothing(point: MetricPoint) {
  return (
    point.cpu === null &&
    point.load === null &&
    point.memory === null &&
    point.disk === null &&
    point.network === null &&
    point.rspamd === null &&
    point.postfix === null &&
    point.fail2ban === null &&
    point.clamavAge === null
  );
}
