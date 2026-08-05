import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { PaginatedResult, PaginationQuery } from "../common/pagination.validation";
import { Account } from "../entities/account.entity";
import { Notification } from "../entities/notification.entity";
import { NotificationPreference } from "../entities/notification-preference.entity";

export const NOTIFICATION_SOURCES = ["support", "supervision"] as const;
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
}

// What a source does for an account that has never said anything. Support
// reaches everyone who can read the ticket it is about; the machine's alerts
// reach nobody until they are asked for. A red figure is a fact about the host
// rather than about anyone's work, and a mailbox filled by one busy afternoon is
// a mailbox that stops being read.
const DEFAULT_CHANNELS: Record<NotificationSource, NotificationChannels> = {
  support: { inApp: true, email: true },
  supervision: { inApp: false, email: false },
};
const FEED_LIMIT = 20;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationPreference) private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>
  ) {}

  async channelsFor(accountId: string, source: NotificationSource): Promise<NotificationChannels> {
    const row = await this.preferences.findOne({ where: { accountId, source } });
    if (!row) return { ...DEFAULT_CHANNELS[source] };
    return { inApp: row.inApp === 1, email: row.email === 1 };
  }

  async preferencesFor(accountId: string): Promise<Record<NotificationSource, NotificationChannels>> {
    const rows = await this.preferences.find({ where: { accountId } });
    const bySource = new Map(rows.map((r) => [r.source, r]));
    return Object.fromEntries(
      NOTIFICATION_SOURCES.map((source) => {
        const row = bySource.get(source);
        return [source, row ? { inApp: row.inApp === 1, email: row.email === 1 } : { ...DEFAULT_CHANNELS[source] }];
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

  async dispatch(input: DispatchInput) {
    const targets = [...new Set(input.accountIds)];
    if (!targets.length) return;

    const enabled = new Set(
      (await this.accounts.find({ where: { id: In(targets) }, select: { id: true, enabled: true } }))
        .filter((a) => a.enabled === 1)
        .map((a) => a.id)
    );

    const rows: Notification[] = [];
    for (const accountId of targets) {
      if (!enabled.has(accountId)) continue;
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
    }

    if (rows.length) await this.notifications.save(rows);
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
