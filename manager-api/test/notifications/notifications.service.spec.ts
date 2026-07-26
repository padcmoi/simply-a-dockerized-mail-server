import { describe, it, expect, beforeEach } from "vitest";
import { IsNull } from "typeorm";
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
  });
});
