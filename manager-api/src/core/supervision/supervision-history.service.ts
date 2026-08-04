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
}

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
}

// A week holds around sixty thousand rows and a chart holds eighty-four columns
// of pixels, so the grouping happens in SQL over the index and never by handing
// a month of samples to javascript.
const QUERY = `
  SELECT FLOOR(at / ?) * ? AS at,
         AVG(cpu) AS cpu,
         AVG(load_1) AS load1,
         AVG(load_5) AS load5,
         AVG(load_15) AS load15,
         AVG(memory_used) AS memory_used,
         MAX(memory_total) AS memory_total,
         AVG(net_in) AS net_in,
         AVG(net_out) AS net_out
    FROM metrics_history
   WHERE at >= ?
GROUP BY 1
ORDER BY 1
`;

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
      if (!row) return { at, cpu: null, load: null, memory: null, network: null };

      const total = Number(row.memory_total);
      return {
        at,
        cpu: row.cpu === null ? null : Number(row.cpu),
        load: [Number(row.load1), Number(row.load5), Number(row.load15)],
        memory: total > 0 ? (Number(row.memory_used) / total) * 100 : 0,
        network: row.net_in === null || row.net_out === null ? null : [Number(row.net_in), Number(row.net_out)],
      };
    });

    return { range, step: window.step, points };
  }
}
