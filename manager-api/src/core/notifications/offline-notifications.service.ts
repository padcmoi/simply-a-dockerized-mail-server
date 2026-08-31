import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, LessThanOrEqual, MoreThan, Repository } from "typeorm";
import { Account } from "../entities/account.entity";
import { AccountProfile } from "../entities/account-profile.entity";
import { Notification } from "../entities/notification.entity";
import { MailerService } from "../mailer/mailer.service";
import { pendingNotificationsEmail } from "../mailer/templates";
import { AppSettingsService } from "../settings/app-settings.service";
import { NotificationSource, NotificationsService } from "./notifications.service";

@Injectable()
export class OfflineNotificationsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(OfflineNotificationsService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly notificationsService: NotificationsService,
    private readonly appSettings: AppSettingsService,
    private readonly mailer: MailerService
  ) {}

  onApplicationBootstrap() {
    if (process.env.VITEST || process.env.NODE_ENV === "test") return;
    this.scheduleNext();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext() {
    if (this.stopped) return;
    const interval = this.appSettings.get().offlineSweepIntervalMs;
    this.timer = setTimeout(
      () => {
        void this.sweep()
          .catch((e) => this.log.warn(`Offline notification sweep failed: ${(e as Error).message}`))
          .finally(() => this.scheduleNext());
      },
      interval > 0 ? interval : 20_000
    );
  }

  // One "you have pending notifications" mail per recipient, sent once they have
  // been offline long enough, and only when a notification arrived AFTER the last
  // such mail (offline_notified_at). Reconnecting never re-arms it on its own, so
  // the same unread notification is never mailed twice; only a genuinely newer
  // notification triggers another mail once the recipient is offline again.
  async sweep(now = Date.now()): Promise<void> {
    if (!(await this.mailer.isEnabled())) return;
    const cutoff = new Date(now - this.appSettings.get().offlineNotifyAfterMs);
    const candidates = await this.profiles.find({
      where: { presence: 0, presenceAt: LessThanOrEqual(cutoff) },
      select: { accountId: true, offlineNotifiedAt: true },
    });
    if (!candidates.length) return;

    const ids = candidates.map((c) => c.accountId);
    const emailById = new Map(
      (await this.accounts.find({ where: { id: In(ids) }, select: { id: true, email: true, enabled: true } }))
        .filter((a) => a.enabled === 1)
        .map((a) => [a.id, a.email])
    );

    for (const c of candidates) {
      const email = emailById.get(c.accountId);
      if (!email) continue;
      const since = c.offlineNotifiedAt ?? new Date(0);
      const unread = await this.notifications.find({
        where: { accountId: c.accountId, readAt: IsNull(), createdAt: MoreThan(since) },
        select: { source: true },
      });
      if (!unread.length) continue;
      const prefs = await this.notificationsService.preferencesFor(c.accountId);
      const eligible = [...new Set(unread.map((n) => n.source))].some((s) => prefs[s as NotificationSource]?.email);
      if (!eligible) continue;
      const mail = pendingNotificationsEmail(this.appSettings.get().managerUrl);
      try {
        await this.mailer.sendNotification({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
        await this.markNotified(c.accountId, now);
        this.log.log(`Offline notification email sent to ${email}`);
      } catch (e) {
        this.log.warn(`Offline notification email to ${email} failed: ${(e as Error).message}`);
      }
    }
  }

  private markNotified(accountId: string, now: number) {
    return this.profiles.update({ accountId }, { offlineNotifiedAt: new Date(now) });
  }
}
