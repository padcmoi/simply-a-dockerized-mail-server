import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { MetricsHistory } from "../entities/metrics-history.entity";
import { AppSettingsService } from "../settings/app-settings.service";
import { SystemMetricsService, type SystemSnapshot } from "./system-metrics.service";

/** Sixty intervals of one second: the minute the live cards promise. */
export const LIVE_POINTS = 61;
/** How much of the machine one recorded row stands for. */
export const WRITE_MS = 10_000;
const PRUNE_MS = 3_600_000;

// The one place the host is read. `tick` is driven by the supervision watcher,
// which the websocket service polls from boot whether or not anybody is
// watching: /proc counters are read as deltas between two samples, so a second
// loop would reset this one's baseline and report rates nobody's machine ever did.
//
// Nothing is written every second. Samples are averaged in memory and one row
// lands every ten, which is 6 rows a minute and about 60 000 for the week kept
// by default, all of it read back through an index and aggregated in SQL. How
// long that is kept is `supervision_retention_ms`, read from the settings on
// every pass rather than at boot, so changing it in the settings page applies to
// the next hourly purge instead of at the next restart.
@Injectable()
export class SupervisionRecorderService {
  private readonly log = new Logger(SupervisionRecorderService.name);

  /** Averaged into one row on the next write, then dropped. */
  private pending: SystemSnapshot[] = [];
  /** The live minute, at the resolution the page draws it. */
  private live: SystemSnapshot[] = [];
  private lastWriteAt = 0;
  private lastPruneAt = 0;

  constructor(
    private readonly metrics: SystemMetricsService,
    @InjectRepository(MetricsHistory) private readonly history: Repository<MetricsHistory>,
    private readonly settings: AppSettingsService
  ) {}

  // A tab that has just opened is on the live minute, and a minute it has to
  // spend filling is a minute of watching a line crawl in from the left. The
  // loop has been running since boot, so the minute already exists and is handed
  // over whole. Kept at the page's own one-second resolution: the recorded rows
  // are ten-second averages, and splicing the two would draw an axis whose left
  // half counts differently from its right.
  recent() {
    return this.live;
  }

  latest(): SystemSnapshot | null {
    return this.live[this.live.length - 1] ?? null;
  }

  async tick(): Promise<SystemSnapshot> {
    const snapshot = await this.metrics.sample();
    this.pending.push(snapshot);
    this.live = [...this.live, snapshot].slice(-LIVE_POINTS);

    const now = snapshot.at;
    if (!this.lastWriteAt) this.lastWriteAt = now;
    if (!this.lastPruneAt) {
      // Once at boot as well: a host restarted every day would otherwise never
      // reach the first hourly pass and keep the week before it forever.
      this.lastPruneAt = now;
      await this.prune();
    }

    if (now - this.lastWriteAt >= WRITE_MS) {
      this.lastWriteAt = now;
      await this.write();
    }
    if (now - this.lastPruneAt >= PRUNE_MS) {
      this.lastPruneAt = now;
      await this.prune();
    }

    return snapshot;
  }

  private mean(values: number[]) {
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  }

  // The average of what came in rather than the last of it: a row standing for
  // ten seconds should say what those ten seconds were, and a spike landing on
  // the instant of the write would otherwise become the whole interval.
  private async write() {
    const batch = this.pending;
    this.pending = [];
    if (!batch.length) return;

    const last = batch[batch.length - 1] as SystemSnapshot;
    const rates = batch.map((sample) => sample.network).filter((network) => network !== null);

    try {
      await this.history.insert({
        at: Date.now(),
        cpu: this.mean(batch.map((sample) => sample.cpu).filter((value) => value !== null)),
        load1: last.load.one,
        load5: last.load.five,
        load15: last.load.fifteen,
        memoryUsed: this.mean(batch.map((sample) => sample.memory.used)) ?? last.memory.used,
        memoryTotal: last.memory.total,
        netIn: this.mean(rates.map((network) => network.in).filter((value) => value !== null)),
        netOut: this.mean(rates.map((network) => network.out).filter((value) => value !== null)),
      });
    } catch (e) {
      this.log.warn(`recording the machine failed: ${(e as Error).message}`);
    }
  }

  private async prune() {
    try {
      await this.history.delete({ at: LessThan(Date.now() - this.settings.get().supervisionRetentionMs) });
    } catch (e) {
      this.log.warn(`pruning the recorded machine history failed: ${(e as Error).message}`);
    }
  }
}
