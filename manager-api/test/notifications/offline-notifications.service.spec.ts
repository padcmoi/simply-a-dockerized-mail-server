import { describe, it, expect, beforeEach, vi } from "vitest";
import { OfflineNotificationsService } from "../../src/core/notifications/offline-notifications.service";
import type { NotificationsService } from "../../src/core/notifications/notifications.service";
import type { MailerService } from "../../src/core/mailer/mailer.service";
import type { AppSettingsService } from "../../src/core/settings/app-settings.service";
import type { Account } from "../../src/core/entities/account.entity";
import type { AccountProfile } from "../../src/core/entities/account-profile.entity";
import type { Notification } from "../../src/core/entities/notification.entity";
import { entity, providerMock, repoMock, type Loose } from "../helpers/mocks";

const appSettings = providerMock<AppSettingsService>({
  get: vi.fn().mockReturnValue({ offlineNotifyAfterMs: 300000, offlineSweepIntervalMs: 20000, mailMinIntervalMs: 30000, managerUrl: "" }),
});

const ALICE = "alice-id";

describe("OfflineNotificationsService", () => {
  let profiles: ReturnType<typeof repoMock<AccountProfile>>;
  let notifications: ReturnType<typeof repoMock<Notification>>;
  let accounts: ReturnType<typeof repoMock<Account>>;
  let notificationsService: Loose<NotificationsService>;
  let mailer: Loose<MailerService>;
  let svc: OfflineNotificationsService;

  beforeEach(() => {
    profiles = repoMock<AccountProfile>();
    notifications = repoMock<Notification>();
    accounts = repoMock<Account>();
    profiles.find.mockResolvedValue([entity<AccountProfile>({ accountId: ALICE })]);
    profiles.update.mockResolvedValue(undefined);
    accounts.find.mockResolvedValue([entity<Account>({ id: ALICE, email: "alice@example.com", enabled: 1 })]);
    notifications.find.mockResolvedValue([entity<Notification>({ source: "support" })]);
    notificationsService = providerMock<NotificationsService>({
      preferencesFor: vi.fn().mockResolvedValue({ support: { inApp: true, email: true } }),
    });
    mailer = providerMock<MailerService>({
      sendNotification: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue(true),
    });
    svc = new OfflineNotificationsService(profiles, notifications, accounts, notificationsService, appSettings, mailer);
  });

  it("emails an offline account with pending notifications, then marks it notified once", async () => {
    await svc.sweep();
    expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
    expect(mailer.sendNotification.mock.calls[0][0]).toMatchObject({ to: "alice@example.com" });
    expect(profiles.update).toHaveBeenCalledWith({ accountId: ALICE }, { offlineNotifiedAt: expect.any(Date) });
  });

  it("does nothing when outbound mail is not configured", async () => {
    mailer.isEnabled.mockResolvedValue(false);
    await svc.sweep();
    expect(profiles.find).not.toHaveBeenCalled();
    expect(mailer.sendNotification).not.toHaveBeenCalled();
  });

  it("skips, and does not mark, an account with no pending notifications", async () => {
    notifications.find.mockResolvedValue([]);
    await svc.sweep();
    expect(mailer.sendNotification).not.toHaveBeenCalled();
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it("does not email nor mark when the account disabled the email channel", async () => {
    notificationsService.preferencesFor.mockResolvedValue({ support: { inApp: true, email: false } });
    await svc.sweep();
    expect(mailer.sendNotification).not.toHaveBeenCalled();
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it("does not mark notified when the summary email fails, so a later sweep retries", async () => {
    mailer.sendNotification.mockRejectedValue(new Error("smtp down"));
    await svc.sweep();
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it("ignores disabled accounts", async () => {
    accounts.find.mockResolvedValue([entity<Account>({ id: ALICE, email: "alice@example.com", enabled: 0 })]);
    await svc.sweep();
    expect(mailer.sendNotification).not.toHaveBeenCalled();
  });
});
