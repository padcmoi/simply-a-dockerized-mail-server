import { Injectable } from "@nestjs/common";
import { PostfixService, type QueueDirStats } from "../postfix/postfix.service";
import { RspamdService, type RspamdStats } from "../rspamd/rspamd.service";

// rspamd's own counters, the ones its page tiles: every verdict a message can
// get, and what the Bayes filter was taught, each counted since rspamd
// started. The curves are these figures over time, exactly as the tiles read.
export interface RspamdCounters {
  scanned: number;
  noAction: number;
  greylist: number;
  addHeader: number;
  reject: number;
  learned: number;
}

// What the two mail services add to a sample of the machine.
export interface ServiceSample {
  /** rspamd's counters at that moment; null while rspamd is out of reach. */
  rspamd: RspamdCounters | null;
  /** Messages waiting in each queue directory; null while the spool is out of reach. */
  postfix: QueueDirStats | null;
}

export function countersOf(stats: RspamdStats): RspamdCounters {
  const a = stats.actions;
  return {
    scanned: stats.scanned,
    noAction: a["no action"],
    greylist: a.greylist,
    addHeader: a["add header"],
    reject: a.reject,
    learned: stats.learned ?? 0,
  };
}

// The two services, read by the machine's own loop on every tick. A service
// that cannot be reached is null for that sample, never a row of zeros: zero
// is a figure, and it is not this one.
@Injectable()
export class ServiceMetricsService {
  constructor(
    private readonly rspamd: RspamdService,
    private readonly postfix: PostfixService
  ) {}

  async sample(): Promise<ServiceSample> {
    const [rspamd, postfix] = await Promise.all([this.readRspamd(), this.readPostfix()]);
    return { rspamd, postfix };
  }

  private async readRspamd() {
    try {
      return countersOf(await this.rspamd.stats());
    } catch {
      return null;
    }
  }

  private async readPostfix() {
    try {
      const queue = await this.postfix.queueStats();
      return queue.available ? queue.total : null;
    } catch {
      return null;
    }
  }
}
