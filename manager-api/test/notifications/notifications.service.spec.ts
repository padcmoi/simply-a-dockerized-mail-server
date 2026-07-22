import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IsNull } from "typeorm";
import { NotificationsService } from "../../src/core/notifications/notifications.service";
import type { MailerService } from "../../src/core/mailer/mailer.service";
import type { Account } from "../../src/core/entities/account.entity";
import type { Notification } from "../../src/core/entities/notification.entity";
import type { NotificationPreference } from "../../src/core/entities/notification-preference.entity";
import { entity, providerMock, repoMock, type Loose } from "../helpers/mocks";

const ALICE = "alice-id";
const BOB = "bob-id";

describe("NotificationsService", () => {
  let notifications: ReturnType<typeof repoMock<Notification>>;
  let preferences: ReturnType<typeof repoMock<NotificationPreference>>;
  let accounts: ReturnType<typeof repoMock<Account>>;
  let mailer: Loose<MailerService>;
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
    mailer = providerMock<MailerService>({ sendNotification: vi.fn().mockResolvedValue(undefined) });
    svc = new NotificationsService(notifications, preferences, accounts, mailer);
  });

  const input = (accountIds: string[]) => ({
    accountIds,
    source: "support" as const,
    type: "ticket-created",
    payload: { ticketId: 5 },
    link: "/tickets/5",
    email: { subject: "s", text: "t" },
  });

  describe("channel defaults", () => {
    it("enables both channels when the account never touched its preferences", async () => {
      await expect(svc.channelsFor(ALICE, "support")).resolves.toEqual({ inApp: true, email: true });
    });

    it("reports every known source with the defaults applied", async () => {
      await expect(svc.preferencesFor(ALICE)).resolves.toEqual({ support: { inApp: true, email: true } });
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

  describe("dispatch", () => {
    it("writes one row per recipient and mails each of them", async () => {
      await svc.dispatch(input([ALICE, BOB]));
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(mailer.sendNotification).toHaveBeenCalledTimes(2);
    });

    it("deduplicates a recipient listed twice", async () => {
      await svc.dispatch(input([ALICE, ALICE]));
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
    });

    it("writes nothing at all when the recipient list is empty", async () => {
      await svc.dispatch(input([]));
      expect(notifications.save).not.toHaveBeenCalled();
      expect(mailer.sendNotification).not.toHaveBeenCalled();
    });

    it("skips the in-app row when the account disabled that channel", async () => {
      preferences.findOne.mockResolvedValue(entity<NotificationPreference>({ inApp: 0, email: 1 }));
      await svc.dispatch(input([ALICE]));
      expect(notifications.save).not.toHaveBeenCalled();
      expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
    });

    it("skips the mail when the account disabled that channel", async () => {
      preferences.findOne.mockResolvedValue(entity<NotificationPreference>({ inApp: 1, email: 0 }));
      await svc.dispatch(input([ALICE]));
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(mailer.sendNotification).not.toHaveBeenCalled();
    });

    it("reaches neither channel when the account turned both off", async () => {
      preferences.findOne.mockResolvedValue(entity<NotificationPreference>({ inApp: 0, email: 0 }));
      await svc.dispatch(input([ALICE]));
      expect(notifications.save).not.toHaveBeenCalled();
      expect(mailer.sendNotification).not.toHaveBeenCalled();
    });

    it("ignores a disabled account", async () => {
      accounts.find.mockResolvedValue([entity<Account>({ id: ALICE, email: "alice@example.com", enabled: 0 })]);
      await svc.dispatch(input([ALICE]));
      expect(notifications.save).not.toHaveBeenCalled();
      expect(mailer.sendNotification).not.toHaveBeenCalled();
    });

    it("still stores the in-app rows when the mail transport fails", async () => {
      mailer.sendNotification.mockRejectedValue(new Error("smtp down"));
      await expect(svc.dispatch(input([ALICE]))).resolves.toBeUndefined();
      expect(notifications.save).toHaveBeenCalled();
    });
  });

  // A busy thread must not turn into a burst of mail: the server would look
  // like a spammer. Only the mail is throttled, the in-app row always lands.
  describe("email throttling", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("drops a second mail to the same account inside the window", async () => {
      await svc.dispatch(input([ALICE]));
      await svc.dispatch(input([ALICE]));
      expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
    });

    it("still writes every in-app row while the mail is throttled", async () => {
      await svc.dispatch(input([ALICE]));
      notifications.create.mockClear();
      await svc.dispatch(input([ALICE]));
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it("survives a burst without mailing more than once", async () => {
      for (let i = 0; i < 25; i++) await svc.dispatch(input([ALICE]));
      expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
    });

    it("throttles each account on its own clock", async () => {
      await svc.dispatch(input([ALICE]));
      await svc.dispatch(input([BOB]));
      expect(mailer.sendNotification).toHaveBeenCalledTimes(2);
    });

    it("mails again once the window elapsed", async () => {
      await svc.dispatch(input([ALICE]));
      vi.advanceTimersByTime(30_000);
      await svc.dispatch(input([ALICE]));
      expect(mailer.sendNotification).toHaveBeenCalledTimes(2);
    });

    it("still holds the mail one millisecond before the window closes", async () => {
      await svc.dispatch(input([ALICE]));
      vi.advanceTimersByTime(29_999);
      await svc.dispatch(input([ALICE]));
      expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
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
  });
});
