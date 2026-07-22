import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { PaginatedResult, PaginationQuery } from "../common/pagination.validation";
import { Account } from "../entities/account.entity";
import { Notification } from "../entities/notification.entity";
import { NotificationPreference } from "../entities/notification-preference.entity";
import { MailerService } from "../mailer/mailer.service";

export const NOTIFICATION_SOURCES = ["support"] as const;
export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
}

export interface DispatchInput {
  accountIds: string[];
  source: NotificationSource;
  type: string;
  payload: Record<string, unknown>;
  link: string;
  email: { subject: string; text: string };
}

const DEFAULT_CHANNELS: NotificationChannels = { inApp: true, email: true };
const FEED_LIMIT = 20;

// A burst of activity on a thread must never turn into a burst of mail: a busy
// exchange would flood the recipient and get the server flagged as a spammer.
// The in-app notification is never throttled, only the mail is dropped, so
// nothing is lost from the bell.
const EMAIL_MIN_INTERVAL_MS = Number(process.env.MANAGER_NOTIFICATION_EMAIL_INTERVAL_MS ?? 30_000);

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly lastEmailAt = new Map<string, number>();

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationPreference) private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly mailer: MailerService
  ) {}

  async channelsFor(accountId: string, source: NotificationSource): Promise<NotificationChannels> {
    const row = await this.preferences.findOne({ where: { accountId, source } });
    if (!row) return { ...DEFAULT_CHANNELS };
    return { inApp: row.inApp === 1, email: row.email === 1 };
  }

  async preferencesFor(accountId: string): Promise<Record<NotificationSource, NotificationChannels>> {
    const rows = await this.preferences.find({ where: { accountId } });
    const bySource = new Map(rows.map((r) => [r.source, r]));
    return Object.fromEntries(
      NOTIFICATION_SOURCES.map((source) => {
        const row = bySource.get(source);
        return [source, row ? { inApp: row.inApp === 1, email: row.email === 1 } : { ...DEFAULT_CHANNELS }];
      })
    ) as Record<NotificationSource, NotificationChannels>;
  }

  async setPreference(accountId: string, source: NotificationSource, channels: NotificationChannels) {
    await this.preferences.save(
      this.preferences.create({
        accountId,
        source,
        inApp: channels.inApp ? 1 : 0,
        email: channels.email ? 1 : 0,
      })
    );
    return this.preferencesFor(accountId);
  }

  private mayEmail(accountId: string, now: number): boolean {
    const last = this.lastEmailAt.get(accountId);
    if (last !== undefined && now - last < EMAIL_MIN_INTERVAL_MS) return false;
    this.lastEmailAt.set(accountId, now);
    return true;
  }

  private pruneEmailWindow(now: number) {
    for (const [accountId, at] of this.lastEmailAt) {
      if (now - at >= EMAIL_MIN_INTERVAL_MS) this.lastEmailAt.delete(accountId);
    }
  }

  async dispatch(input: DispatchInput) {
    const targets = [...new Set(input.accountIds)];
    if (!targets.length) return;

    const now = Date.now();
    this.pruneEmailWindow(now);
    const rows: Notification[] = [];
    const mailTo: string[] = [];
    const emailById = new Map(
      (await this.accounts.find({ where: { id: In(targets) }, select: { id: true, email: true, enabled: true } }))
        .filter((a) => a.enabled === 1)
        .map((a) => [a.id, a.email])
    );

    for (const accountId of targets) {
      const email = emailById.get(accountId);
      if (!email) continue;
      const channels = await this.channelsFor(accountId, input.source);
      if (channels.inApp) {
        rows.push(
          this.notifications.create({
            accountId,
            source: input.source,
            type: input.type,
            payload: input.payload,
            link: input.link,
          })
        );
      }
      if (channels.email) {
        if (this.mayEmail(accountId, now)) mailTo.push(email);
        else this.log.debug(`Notification mail to ${email} skipped, still inside the ${EMAIL_MIN_INTERVAL_MS}ms window`);
      }
    }

    if (rows.length) await this.notifications.save(rows);
    for (const to of mailTo) {
      try {
        await this.mailer.sendNotification({ to, subject: input.email.subject, text: input.email.text });
      } catch (e) {
        this.log.warn(`Notification email to ${to} failed: ${(e as Error).message}`);
      }
    }
  }

  async list(accountId: string, query: PaginationQuery) {
    const where = { accountId };
    const order = { createdAt: query.sortDir === "asc" ? ("ASC" as const) : ("DESC" as const) };
    if (query.limit === undefined) return this.notifications.find({ where, order });
    const [items, total] = await this.notifications.findAndCount({
      where,
      order,
      skip: query.offset,
      take: query.limit,
    });
    return { items, total } satisfies PaginatedResult<Notification>;
  }

  async feed(accountId: string) {
    const [items, unread] = await Promise.all([
      this.notifications.find({ where: { accountId }, order: { createdAt: "DESC" }, take: FEED_LIMIT }),
      this.unreadCount(accountId),
    ]);
    return { unread, items };
  }

  unreadCount(accountId: string) {
    return this.notifications.count({ where: { accountId, readAt: IsNull() } });
  }

  async markRead(accountId: string, id: number) {
    await this.notifications.update({ id, accountId, readAt: IsNull() }, { readAt: new Date() });
    return this.feed(accountId);
  }

  async markAllRead(accountId: string) {
    await this.notifications.update({ accountId, readAt: IsNull() }, { readAt: new Date() });
    return this.feed(accountId);
  }

  async remove(accountId: string, id: number) {
    await this.notifications.delete({ id, accountId });
    return this.feed(accountId);
  }
}
