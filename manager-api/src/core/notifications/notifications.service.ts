import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Like, Not, Repository } from "typeorm";
import type { NotificationListQuery } from "../../api/notifications/notifications.validation";
import { PaginatedResult, resolveSearchColumn, resolveSortColumn } from "../common/pagination.validation";
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
export const NOTIFICATION_SORTABLE_COLUMNS = ["createdAt", "source", "type", "readAt"] as const;

// The fields a `searchBy` may name, matching what the free-text search spans
// when it names none. `payload` and `link` have no column of their own in the
// list: they are what a notification is about, searched but never picked.
export const NOTIFICATION_SEARCHABLE_COLUMNS = ["source", "type", "payload", "link"] as const;

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

  async list(accountId: string, query: NotificationListQuery) {
    const sortBy = resolveSortColumn(query.sortBy, NOTIFICATION_SORTABLE_COLUMNS, "createdAt");
    const order = { [sortBy]: query.sortDir === "asc" ? ("ASC" as const) : ("DESC" as const) };
    const read = query.read === "read" ? Not(IsNull()) : query.read === "unread" ? IsNull() : undefined;
    const base = { accountId, ...(read ? { readAt: read } : {}), ...(query.source ? { source: query.source } : {}) };
    // The payload carries what a notification is ABOUT (a ticket's subject, a
    // domain, the figure that went red), so a search that skipped it would only
    // ever match the machine words in `source` and `type`.
    const term = query.search ? Like(`%${query.search}%`) : null;
    // The `source` branch is dropped, not neutralised, when a source is already
    // filtered on: left in it would widen to "every row of that source", which
    // is the search answering with rows that do not match it.
    const searchable = NOTIFICATION_SEARCHABLE_COLUMNS.filter((field) => !(query.source && field === "source"));
    // A `searchBy` naming the source while a source is already filtered on
    // resolves to nothing and leaves the search as it was, which is the same
    // answer the dropped branch above gives.
    const searchBy = resolveSearchColumn(query.searchBy, searchable);
    const where = term
      ? searchable.filter((field) => !searchBy || field === searchBy).map((field) => ({ ...base, [field]: term }))
      : base;

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

  async markUnread(accountId: string, id: number) {
    await this.notifications.update({ id, accountId, readAt: Not(IsNull()) }, { readAt: null });
    return this.feed(accountId);
  }

  async remove(accountId: string, id: number) {
    await this.notifications.delete({ id, accountId });
    return this.feed(accountId);
  }

  // "read" and not "all" is the default at the schema, and the screen says which
  // of the two it is about to do: emptying the whole history is a way to lose a
  // notification that was never opened.
  async purge(accountId: string, scope: "all" | "read") {
    await this.notifications.delete(scope === "all" ? { accountId } : { accountId, readAt: Not(IsNull()) });
    return this.feed(accountId);
  }
}
