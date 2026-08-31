import { describe, it, expect, beforeEach } from "vitest";
import { IsNull, Like, Not } from "typeorm";
import { NotificationsService } from "../../src/core/notifications/notifications.service";
import type { Account } from "../../src/core/entities/account.entity";
import type { Notification } from "../../src/core/entities/notification.entity";
import type { NotificationPreference } from "../../src/core/entities/notification-preference.entity";
import { entity, repoMock } from "../helpers/mocks";

const ALICE = "alice-id";
const BOB = "bob-id";

describe("NotificationsService", () => {
  let notifications: ReturnType<typeof repoMock<Notification>>;
  let preferences: ReturnType<typeof repoMock<NotificationPreference>>;
  let accounts: ReturnType<typeof repoMock<Account>>;
  let svc: NotificationsService;

  beforeEach(() => {
    notifications = repoMock<Notification>();
    preferences = repoMock<NotificationPreference>();
    accounts = repoMock<Account>();
    preferences.findOne.mockResolvedValue(null);
    preferences.find.mockResolvedValue([]);
    notifications.save.mockResolvedValue([]);
    notifications.find.mockResolvedValue([]);
    notifications.count.mockResolvedValue(0);
    accounts.find.mockResolvedValue([
      entity<Account>({ id: ALICE, email: "alice@example.com", enabled: 1 }),
      entity<Account>({ id: BOB, email: "bob@example.com", enabled: 1 }),
    ]);
    svc = new NotificationsService(notifications, preferences, accounts);
  });

  const input = (accountIds: string[]) => ({
    accountIds,
    source: "support" as const,
    type: "ticket-created",
    payload: { ticketId: 5 },
    link: "/tickets/5",
  });

  describe("channel defaults", () => {
    it("enables both channels when the account never touched its preferences", async () => {
      await expect(svc.channelsFor(ALICE, "support")).resolves.toEqual({ inApp: true, email: true });
    });

    // Each source carries its own default. The support reaches whoever can read
    // the ticket it is about; the machine's alerts reach nobody until they are
    // asked for, a red figure being a fact about the host and not about anyone's
    // work.
    it("reports every known source with its own defaults applied", async () => {
      await expect(svc.preferencesFor(ALICE)).resolves.toEqual({
        support: { inApp: true, email: true },
        supervision: { inApp: false, email: false },
      });
    });

    it("leaves the machine silent for an account that never asked for it", async () => {
      await expect(svc.channelsFor(ALICE, "supervision")).resolves.toEqual({ inApp: false, email: false });
    });

    it("writes nothing at all for a source nobody switched on", async () => {
      await svc.dispatch({ ...input([ALICE]), source: "supervision", type: "machine-memory" });
      expect(notifications.save).not.toHaveBeenCalled();
    });

    it("reads back what the stored row says", async () => {
      preferences.findOne.mockResolvedValue(entity<NotificationPreference>({ inApp: 0, email: 1 }));
      await expect(svc.channelsFor(ALICE, "support")).resolves.toEqual({ inApp: false, email: true });
    });

    it("persists a preference as tinyint flags", async () => {
      await svc.setPreference(ALICE, "support", { inApp: false, email: true });
      expect(preferences.create).toHaveBeenCalledWith({ accountId: ALICE, source: "support", inApp: 0, email: 1 });
      expect(preferences.save).toHaveBeenCalled();
    });
  });

  describe("dispatch (in-app rows only; mail is handled by the offline sweep)", () => {
    it("writes one in-app row per recipient", async () => {
      await svc.dispatch(input([ALICE, BOB]));
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(notifications.save).toHaveBeenCalled();
    });

    it("deduplicates a recipient listed twice", async () => {
      await svc.dispatch(input([ALICE, ALICE]));
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it("writes nothing at all when the recipient list is empty", async () => {
      await svc.dispatch(input([]));
      expect(notifications.save).not.toHaveBeenCalled();
    });

    it("still writes the in-app row when only the email channel is off", async () => {
      preferences.findOne.mockResolvedValue(entity<NotificationPreference>({ inApp: 1, email: 0 }));
      await svc.dispatch(input([ALICE]));
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it("skips the in-app row when the account disabled that channel", async () => {
      preferences.findOne.mockResolvedValue(entity<NotificationPreference>({ inApp: 0, email: 1 }));
      await svc.dispatch(input([ALICE]));
      expect(notifications.save).not.toHaveBeenCalled();
    });

    it("ignores a disabled account", async () => {
      accounts.find.mockResolvedValue([entity<Account>({ id: ALICE, email: "alice@example.com", enabled: 0 })]);
      await svc.dispatch(input([ALICE]));
      expect(notifications.save).not.toHaveBeenCalled();
    });
  });

  describe("feed and read state", () => {
    it("counts only the unread rows of that account", async () => {
      notifications.count.mockResolvedValue(3);
      await expect(svc.unreadCount(ALICE)).resolves.toBe(3);
      expect(notifications.count).toHaveBeenCalledWith({ where: { accountId: ALICE, readAt: IsNull() } });
    });

    it("returns the unread count next to the latest rows", async () => {
      notifications.count.mockResolvedValue(2);
      notifications.find.mockResolvedValue([entity<Notification>({ id: 9 })]);
      await expect(svc.feed(ALICE)).resolves.toEqual({ unread: 2, items: [{ id: 9 }] });
    });

    it("marks one row read, scoped to its owner", async () => {
      await svc.markRead(ALICE, 9);
      expect(notifications.update).toHaveBeenCalledWith(
        { id: 9, accountId: ALICE, readAt: IsNull() },
        expect.objectContaining({ readAt: expect.any(Date) })
      );
    });

    it("marks every unread row of that account read", async () => {
      await svc.markAllRead(ALICE);
      expect(notifications.update).toHaveBeenCalledWith(
        { accountId: ALICE, readAt: IsNull() },
        expect.objectContaining({ readAt: expect.any(Date) })
      );
    });

    it("deletes only within the caller's own rows", async () => {
      await svc.remove(ALICE, 9);
      expect(notifications.delete).toHaveBeenCalledWith({ id: 9, accountId: ALICE });
    });

    it("marks one row unread again, scoped to its owner and to what was read", async () => {
      await svc.markUnread(ALICE, 9);
      expect(notifications.update).toHaveBeenCalledWith({ id: 9, accountId: ALICE, readAt: Not(IsNull()) }, { readAt: null });
    });

    it("purges what was read, and only that, by default", async () => {
      await svc.purge(ALICE, "read");
      expect(notifications.delete).toHaveBeenCalledWith({ accountId: ALICE, readAt: Not(IsNull()) });
    });

    it("purges the whole history of that one account when asked for all", async () => {
      await svc.purge(ALICE, "all");
      expect(notifications.delete).toHaveBeenCalledWith({ accountId: ALICE });
    });

    it("answers a purge with the caller's refreshed feed", async () => {
      notifications.count.mockResolvedValue(0);
      await expect(svc.purge(ALICE, "all")).resolves.toEqual({ unread: 0, items: [] });
    });
  });

  describe("list", () => {
    const query = (over: Record<string, unknown> = {}) => ({ offset: 0, sortDir: "desc" as const, ...over });

    beforeEach(() => {
      notifications.findAndCount.mockResolvedValue([[], 0]);
    });

    it("hands back the unpaginated array when no limit is asked for", async () => {
      notifications.find.mockResolvedValue([entity<Notification>({ id: 1 })]);
      await expect(svc.list(ALICE, query())).resolves.toEqual([{ id: 1 }]);
      expect(notifications.findAndCount).not.toHaveBeenCalled();
    });

    it("pages, and never past the caller's own rows", async () => {
      notifications.findAndCount.mockResolvedValue([[entity<Notification>({ id: 1 })], 7]);
      await expect(svc.list(ALICE, query({ limit: 10, offset: 10 }))).resolves.toEqual({ items: [{ id: 1 }], total: 7 });
      expect(notifications.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: ALICE }, skip: 10, take: 10 })
      );
    });

    it("keeps only the unread ones, or only the read ones", async () => {
      await svc.list(ALICE, query({ limit: 10, read: "unread" }));
      expect(notifications.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: ALICE, readAt: IsNull() } })
      );

      await svc.list(ALICE, query({ limit: 10, read: "read" }));
      expect(notifications.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: ALICE, readAt: Not(IsNull()) } })
      );
    });

    it("searches the payload too, every branch still scoped to the account", async () => {
      await svc.list(ALICE, query({ limit: 10, search: "ovh" }));
      const where = notifications.findAndCount.mock.calls[0]![0]!.where as Record<string, unknown>[];
      expect(where.map((clause) => Object.keys(clause).filter((k) => k !== "accountId")[0])).toEqual([
        "source",
        "type",
        "payload",
        "link",
      ]);
      expect(where.every((clause) => clause.accountId === ALICE)).toBe(true);
      expect(where[2]).toMatchObject({ payload: Like("%ovh%") });
    });

    it("keeps only what one source raised", async () => {
      await svc.list(ALICE, query({ limit: 10, source: "supervision" }));
      expect(notifications.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: ALICE, source: "supervision" } })
      );
    });

    it("drops the source branch of a search rather than widening it to the whole source", async () => {
      await svc.list(ALICE, query({ limit: 10, search: "ovh", source: "support" }));
      const where = notifications.findAndCount.mock.calls[0]![0]!.where as Record<string, unknown>[];
      expect(where.map((clause) => Object.keys(clause).filter((k) => k !== "accountId" && k !== "source")[0])).toEqual([
        "type",
        "payload",
        "link",
      ]);
      // every branch still narrows on the chosen source, and none of them
      // matches a row merely for being in it
      for (const clause of where) expect(clause.source).toBe("support");
    });

    it("combines the read filter with the search", async () => {
      await svc.list(ALICE, query({ limit: 10, search: "ovh", read: "unread" }));
      const where = notifications.findAndCount.mock.calls[0]![0]!.where as Record<string, unknown>[];
      for (const clause of where) expect(clause).toMatchObject({ accountId: ALICE, readAt: IsNull() });
    });

    it("sorts on a column it knows and falls back to the date on anything else", async () => {
      await svc.list(ALICE, query({ limit: 10, sortBy: "source", sortDir: "asc" }));
      expect(notifications.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { source: "ASC" } }));

      await svc.list(ALICE, query({ limit: 10, sortBy: "payload; DROP TABLE" }));
      expect(notifications.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: "DESC" } }));
    });
  });
});
