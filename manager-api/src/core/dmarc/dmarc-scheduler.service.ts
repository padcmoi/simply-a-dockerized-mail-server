import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { DmarcInboxService } from "./dmarc-inbox.service";
import { DmarcIngestService } from "./dmarc-ingest.service";
import { DmarcRecipientsService } from "./dmarc-recipients.service";
import { DmarcReporterService, previousDay } from "./dmarc-reporter.service";
import { DmarcSettingsService } from "./dmarc-settings.service";

export const INGEST_EVERY_MS = 60_000;
export const SCAN_EVERY_MS = 300_000;
export const REPORT_CHECK_EVERY_MS = 300_000;

@Injectable()
export class DmarcSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(DmarcSchedulerService.name);
  private readonly timers: ReturnType<typeof setInterval>[] = [];
  private reportedDay: string | null = null;
  private prunedDay: string | null = null;

  constructor(
    private readonly ingest: DmarcIngestService,
    private readonly recipients: DmarcRecipientsService,
    private readonly inbox: DmarcInboxService,
    private readonly reporter: DmarcReporterService,
    private readonly settings: DmarcSettingsService
  ) {}

  onApplicationBootstrap() {
    if (process.env.VITEST || process.env.NODE_ENV === "test") return;
    this.every(INGEST_EVERY_MS, () => this.collect());
    this.every(SCAN_EVERY_MS, () => this.inbox.scan());
    this.every(REPORT_CHECK_EVERY_MS, () => this.daily());
  }

  onModuleDestroy() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  private every(ms: number, job: () => Promise<unknown>) {
    const timer = setInterval(() => {
      void job().catch((e) => this.log.warn(`a DMARC job failed: ${(e as Error).message}`));
    }, ms);
    timer.unref?.();
    this.timers.push(timer);
  }

  async collect(): Promise<void> {
    await this.ingest.ingest();
    await this.recipients.resolve();
  }

  async daily(now = Date.now()): Promise<void> {
    const today = new Date(now).toISOString().slice(0, 10);
    if (this.prunedDay !== today) {
      this.prunedDay = today;
      await this.reporter.prune(now);
      await this.inbox.prune(now);
    }

    const settings = await this.settings.get();
    if (!settings.sendingEnabled || this.reportedDay === today) return;
    if (new Date(now).getHours() < settings.reportHour) return;

    this.reportedDay = today;
    await this.collect();
    const summary = await this.reporter.run(previousDay(now));
    this.log.log(`DMARC reports for ${summary.day}: ${summary.sent} sent, ${summary.failed} failed, ${summary.skipped} skipped`);
  }
}
