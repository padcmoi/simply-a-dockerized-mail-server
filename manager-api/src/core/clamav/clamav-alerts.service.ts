import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomPermissionGuardService } from "../custom-permission-guard/custom-permission-guard.service";
import { Account } from "../entities/account.entity";
import { NotificationsService } from "../notifications/notifications.service";
import type { ClamavSample } from "./clamav.types";

/** Past this, the signatures are a scanner reading yesterday's mail: ClamAV
 *  publishes several times a day, and freshclam checks hourly, so a set this old
 *  means the downloads have stopped, not that nothing was published. */
export const CLAMAV_STALE_MS = 86_400_000;

type ClamavTrouble = "clamav-unreachable" | "clamav-stale";

// The two things about the scanner worth waking someone for, and the only two:
// it stopped answering, or the signatures it holds have stopped being renewed.
// Neither shows anywhere else on the supervision page: the queue stays empty,
// the CPU stays idle, and a scanner that catches nothing looks exactly like a
// scanner with nothing to catch.
//
// One notification when it goes wrong and nothing more until it is right again,
// like the machine's own alerts: the loop reads the scanner every minute, and a
// scanner that is down is down for hours.
@Injectable()
export class ClamavAlertsService {
  private readonly log = new Logger(ClamavAlertsService.name);

  /** What is already wrong, so a state that stays wrong stays quiet. */
  private readonly told = new Set<ClamavTrouble>();

  constructor(
    private readonly notifications: NotificationsService,
    private readonly cpg: CustomPermissionGuardService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>
  ) {}

  async inspect(sample: ClamavSample, at = Date.now()) {
    await this.check("clamav-unreachable", !sample.available, {});

    const age = sample.signaturesAt === null ? null : at - sample.signaturesAt;
    await this.check("clamav-stale", age !== null && age >= CLAMAV_STALE_MS, {
      hours: age === null ? 0 : Math.floor(age / 3_600_000),
    });
  }

  private async check(trouble: ClamavTrouble, wrong: boolean, payload: Record<string, unknown>) {
    if (!wrong) return void this.told.delete(trouble);
    if (this.told.has(trouble)) return;

    this.told.add(trouble);
    await this.notify(trouble, payload);
  }

  // Whoever is allowed to look at the scanner: an alert about a page an account
  // cannot open has nowhere to lead.
  private async recipients() {
    const accounts = await this.accounts.find({ where: { enabled: 1 }, select: { id: true, isRoot: true } });
    const reachable: string[] = [];
    for (const account of accounts) {
      if (account.isRoot === 1 || (await this.mayRead(account.id))) reachable.push(account.id);
    }
    return reachable;
  }

  private async mayRead(accountId: string) {
    return (
      (await this.cpg.guard.utils.check.global(accountId, "clamav", "access")) &&
      (await this.cpg.guard.utils.check.global(accountId, "clamav", "view-clamav-status"))
    );
  }

  private async notify(type: ClamavTrouble, payload: Record<string, unknown>) {
    try {
      const accountIds = await this.recipients();
      if (!accountIds.length) return;
      await this.notifications.dispatch({ accountIds, source: "supervision", type, payload, link: "/admin/clamav" });
    } catch (e) {
      // The loop that reads the scanner also records the machine: a
      // notification that cannot be written is a line in the log, never a
      // sampling loop that stops.
      this.log.warn(`notifying about the antivirus failed: ${(e as Error).message}`);
    }
  }
}
