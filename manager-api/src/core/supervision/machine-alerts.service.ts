import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomPermissionGuardService } from "../custom-permission-guard/custom-permission-guard.service";
import { Account } from "../entities/account.entity";
import { NotificationsService } from "../notifications/notifications.service";
import type { SystemSnapshot } from "./system-metrics.service";

// The thresholds the machine cards are painted with, held here and served to the
// interface with the live window: what a card outlines in red is what this
// notifies on, and two copies of the number would eventually disagree about the
// same machine.
//
// Read per core, which is the only way a load average means anything: 4 is idle
// on an eight-thread host and desperate on a single-core one.
export const MACHINE_BUSY = 0.7;
export const MACHINE_SATURATED = 0.9;

// The figures that have a ceiling to be read against, which is what makes a
// ratio and therefore a red. A throughput has none (there is no nominal link
// speed to compare it to) and the instantaneous CPU has no useful one either:
// it touches 100 % on any build and would notify about every busy second.
export const MACHINE_METRICS = ["load", "memory"] as const;
export type MachineMetric = (typeof MACHINE_METRICS)[number];

// One notification when a figure goes red, and nothing more until it has come
// back down. The machine is watched once a second: without this, a load sitting
// on the threshold would notify sixty times a minute.
@Injectable()
export class MachineAlertsService {
  private readonly log = new Logger(MachineAlertsService.name);

  /** What is red right now, so a figure that stays red stays quiet. */
  private readonly red = new Set<MachineMetric>();

  constructor(
    private readonly notifications: NotificationsService,
    private readonly cpg: CustomPermissionGuardService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>
  ) {}

  private ratios(snapshot: SystemSnapshot): Record<MachineMetric, number | null> {
    return {
      load: snapshot.cores > 0 ? snapshot.load.one / snapshot.cores : null,
      memory: snapshot.memory.total > 0 ? snapshot.memory.used / snapshot.memory.total : null,
    };
  }

  async inspect(snapshot: SystemSnapshot) {
    for (const metric of MACHINE_METRICS) {
      const ratio = this.ratios(snapshot)[metric];
      if (ratio === null) continue;

      if (ratio >= MACHINE_SATURATED) {
        if (this.red.has(metric)) continue;
        this.red.add(metric);
        await this.notify(metric, ratio);
        continue;
      }

      // Re-armed under the raised threshold rather than under the red one: a
      // figure hovering on 90 % crosses it in both directions every few seconds,
      // and each crossing would be a notification.
      if (ratio < MACHINE_BUSY) this.red.delete(metric);
    }
  }

  // Whoever can read the live figures, which is the pair the live window and its
  // websocket topic already ask for: a notification about a machine nobody is
  // allowed to look at has nowhere to lead.
  private async mayRead(accountId: string) {
    return (
      (await this.cpg.guard.utils.check.global(accountId, "supervision", "access")) &&
      (await this.cpg.guard.utils.check.global(accountId, "supervision", "view-machine-metrics"))
    );
  }

  private async recipients() {
    const accounts = await this.accounts.find({ where: { enabled: 1 }, select: { id: true, isRoot: true } });
    const reachable: string[] = [];
    for (const account of accounts) {
      if (account.isRoot === 1 || (await this.mayRead(account.id))) reachable.push(account.id);
    }
    return reachable;
  }

  // The percentage is carried as a figure, never as a sentence: the wording is
  // the interface's and is translated at display, like every other notification.
  private async notify(metric: MachineMetric, ratio: number) {
    try {
      const accountIds = await this.recipients();
      if (!accountIds.length) return;
      await this.notifications.dispatch({
        accountIds,
        source: "supervision",
        type: `machine-${metric}`,
        payload: { metric, percent: Math.round(ratio * 100) },
        link: "/admin/supervision",
      });
    } catch (e) {
      // The machine is being watched every second and the loop that watches it
      // also writes the recorded history: a notification that cannot be written
      // is a line in the log, never a sampling loop that stops.
      this.log.warn(`notifying about the machine's ${metric} failed: ${(e as Error).message}`);
    }
  }
}
