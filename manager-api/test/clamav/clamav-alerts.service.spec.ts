import { describe, it, expect, beforeEach, vi } from "vitest";
import { CLAMAV_STALE_MS, ClamavAlertsService } from "../../src/core/clamav/clamav-alerts.service";
import type { Account } from "../../src/core/entities/account.entity";
import type { NotificationsService } from "../../src/core/notifications/notifications.service";
import { cpgMock, entity, providerMock, repoMock, type CpgMock } from "../helpers/mocks";

const NOW = 1_800_000_000_000;
const ROOT = "root-id";
const WATCHER = "watcher-id";

const fresh = { available: true, signaturesAt: NOW - 3_600_000 };
const stale = { available: true, signaturesAt: NOW - CLAMAV_STALE_MS - 1 };
const down = { available: false, signaturesAt: NOW - 3_600_000 };

describe("ClamavAlertsService", () => {
  let notifications: ReturnType<typeof providerMock<NotificationsService>>;
  let dispatch: ReturnType<typeof vi.fn>;
  let cpg: CpgMock;
  let accounts: ReturnType<typeof repoMock<Account>>;
  let svc: ClamavAlertsService;

  beforeEach(() => {
    dispatch = vi.fn(async () => undefined);
    notifications = providerMock<NotificationsService>({ dispatch });
    cpg = cpgMock();
    cpg.guard.utils.check.global.mockResolvedValue(true);
    accounts = repoMock<Account>();
    accounts.find.mockResolvedValue([
      entity<Account>({ id: ROOT, enabled: 1, isRoot: 1 }),
      entity<Account>({ id: WATCHER, enabled: 1, isRoot: 0 }),
    ]);
    svc = new ClamavAlertsService(notifications, cpg, accounts);
  });

  it("says nothing about a scanner that answers with current signatures", async () => {
    await svc.inspect(fresh, NOW);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("tells whoever may look at the scanner that it has stopped answering", async () => {
    await svc.inspect(down, NOW);

    expect(dispatch).toHaveBeenCalledWith({
      accountIds: [ROOT, WATCHER],
      source: "clamav-unreachable",
      type: "clamav-unreachable",
      payload: {},
      link: "/admin/clamav",
    });
  });

  it("tells how old the signatures are once they are a day behind", async () => {
    await svc.inspect(stale, NOW);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ source: "clamav-stale", type: "clamav-stale", payload: { hours: 24 } })
    );
  });

  it("says nothing about signatures a minute short of a day", async () => {
    await svc.inspect({ available: true, signaturesAt: NOW - CLAMAV_STALE_MS + 60_000 }, NOW);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // The loop reads the scanner every minute and a scanner that is down is down
  // for hours: one notification, then quiet until it is right again.
  it("says it once and stays quiet while it stays wrong", async () => {
    await svc.inspect(down, NOW);
    await svc.inspect(down, NOW + 60_000);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("says it again after the scanner came back and went away a second time", async () => {
    await svc.inspect(down, NOW);
    await svc.inspect(fresh, NOW + 60_000);
    await svc.inspect(down, NOW + 120_000);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("carries the two troubles apart: a scanner both down and stale says both", async () => {
    await svc.inspect({ available: false, signaturesAt: NOW - CLAMAV_STALE_MS - 1 }, NOW);

    expect(dispatch.mock.calls.map(([input]) => (input as { type: string }).type)).toEqual([
      "clamav-unreachable",
      "clamav-stale",
    ]);
  });

  it("says nothing about signatures it could not read at all", async () => {
    await svc.inspect({ available: true, signaturesAt: null }, NOW);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // An alert about a page an account cannot open has nowhere to lead.
  it("leaves out an account that may not look at the scanner", async () => {
    cpg.guard.utils.check.global.mockResolvedValue(false);
    await svc.inspect(down, NOW);

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ accountIds: [ROOT] }));
  });

  it("sends nothing at all when nobody may look at it", async () => {
    cpg.guard.utils.check.global.mockResolvedValue(false);
    accounts.find.mockResolvedValue([entity<Account>({ id: WATCHER, enabled: 1, isRoot: 0 })]);

    await svc.inspect(down, NOW);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // The loop that reads the scanner also records the machine: a notification
  // that cannot be written is a line in the log, never a loop that stops.
  it("keeps going when the notification cannot be written", async () => {
    dispatch.mockRejectedValue(new Error("nope"));
    await expect(svc.inspect(down, NOW)).resolves.toBeUndefined();
  });
});
