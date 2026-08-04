import { describe, it, expect, vi, afterEach } from "vitest";
import type { DataSource } from "typeorm";
import { dashboardWatcher } from "../../src/core/websocket/watchers/dashboard.watcher";
import { diskWatcher } from "../../src/core/websocket/watchers/disk.watcher";
import { domainAliasesWatcher } from "../../src/core/websocket/watchers/domain-aliases.watcher";
import { domainPostfixWatcher } from "../../src/core/websocket/watchers/domain-postfix.watcher";
import { domainQuotaWatcher } from "../../src/core/websocket/watchers/domain-quota.watcher";
import { domainRecipientsWatcher } from "../../src/core/websocket/watchers/domain-recipients.watcher";
import { domainRspamdWatcher } from "../../src/core/websocket/watchers/domain-rspamd.watcher";
import { notificationsWatcher } from "../../src/core/websocket/watchers/notifications.watcher";
import { postfixQueueWatcher } from "../../src/core/websocket/watchers/postfix-queue.watcher";
import { presenceWatcher } from "../../src/core/websocket/watchers/presence.watcher";
import { rspamdStatsWatcher } from "../../src/core/websocket/watchers/rspamd-stats.watcher";
import { sessionsWatcher } from "../../src/core/websocket/watchers/sessions.watcher";
import { supervisionWatcher, SUPERVISION_INTERVAL_MS } from "../../src/core/websocket/watchers/supervision.watcher";
import { RspamdService, type RspamdHistoryRow } from "../../src/core/rspamd/rspamd.service";
import type { DomainsService } from "../../src/api/domains/domains.service";
import type { PostfixService } from "../../src/core/postfix/postfix.service";
import type { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import type { NotificationsService } from "../../src/core/notifications/notifications.service";
import type { AccountPresenceService } from "../../src/core/websocket/account-presence.service";
import type { SupervisionRecorderService } from "../../src/core/supervision/supervision-recorder.service";
import { providerMock, entity } from "../helpers/mocks";

describe("dashboardWatcher", () => {
  it("aggregates the console figures and maps each recent row", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ total: "3", active: "2" }])
      .mockResolvedValueOnce([{ total: "10", active: 8 }])
      .mockResolvedValueOnce([{ total: "5" }])
      .mockResolvedValueOnce([{ total: "2", enabled: "abc" }])
      .mockResolvedValueOnce([{ domain: "a.com", count: "4" }])
      .mockResolvedValueOnce([{ id: 1, domain: "a.com", quota: 1000, active: 1 }])
      .mockResolvedValueOnce([{ id: 2, email: "x@a.com", domain: "a.com", active: 0 }]);
    const domains = providerMock<DomainsService>({ disk: vi.fn().mockResolvedValue({ usedBytes: "1" }) });
    const w = dashboardWatcher(providerMock<DataSource>({ query }), domains);
    await expect(w.fn()).resolves.toEqual({
      domains: { total: 3, active: 2 },
      recipients: { total: 10, active: 8 },
      aliases: { total: 5 },
      blockedSenders: { total: 2, enabled: 0 },
      disk: { usedBytes: "1" },
      recipientsPerDomain: [{ domain: "a.com", count: 4 }],
      recentDomains: [{ id: 1, domain: "a.com", quota: "1000", active: 1 }],
      recentRecipients: [{ id: 2, email: "x@a.com", domain: "a.com", active: 0 }],
    });
  });

  it("falls back to zero figures and a null disk when everything is empty", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const domains = providerMock<DomainsService>({ disk: vi.fn().mockRejectedValue(new Error("disk down")) });
    const w = dashboardWatcher(providerMock<DataSource>({ query }), domains);
    await expect(w.fn()).resolves.toEqual({
      domains: { total: 0, active: 0 },
      recipients: { total: 0, active: 0 },
      aliases: { total: 0 },
      blockedSenders: { total: 0, enabled: 0 },
      disk: null,
      recipientsPerDomain: [],
      recentDomains: [],
      recentRecipients: [],
    });
  });
});

describe("diskWatcher", () => {
  it("relays the domains disk usage", async () => {
    const usage = { usedBytes: "42" };
    const domains = providerMock<DomainsService>({ disk: vi.fn().mockResolvedValue(usage) });
    await expect(diskWatcher(domains).fn()).resolves.toBe(usage);
  });
});

describe("domainRecipientsWatcher", () => {
  it("lists the mailboxes of the domain named by its numeric id", async () => {
    const rows = [{ id: 1, email: "a@x.io", quota: "0", active: 1 }];
    const query = vi.fn().mockResolvedValue(rows);
    const w = domainRecipientsWatcher(providerMock<DataSource>({ query }));
    await expect(w.fn("7")).resolves.toBe(rows);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("virtual_users"), [7]);
  });
});

describe("domainAliasesWatcher", () => {
  it("lists the aliases of the domain named by its numeric id", async () => {
    const rows = [{ id: 1, source: "a@x.io", destination: "b@x.io" }];
    const query = vi.fn().mockResolvedValue(rows);
    const w = domainAliasesWatcher(providerMock<DataSource>({ query }));
    await expect(w.fn("7")).resolves.toBe(rows);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("virtual_aliases"), [7]);
  });
});

describe("domainPostfixWatcher", () => {
  it("resolves the domain then asks postfix for its queue stats", async () => {
    const query = vi.fn().mockResolvedValue([{ domain: "x.io" }]);
    const stats = { active: 0 };
    const postfix = providerMock<PostfixService>({ queueStats: vi.fn().mockResolvedValue(stats) });
    const w = domainPostfixWatcher(providerMock<DataSource>({ query }), postfix);
    await expect(w.fn("3")).resolves.toBe(stats);
    expect(query).toHaveBeenCalledWith(expect.any(String), [3]);
    expect(postfix.queueStats).toHaveBeenCalledWith("x.io");
  });

  it("asks for the whole queue when the id matches no domain", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const postfix = providerMock<PostfixService>({ queueStats: vi.fn().mockResolvedValue({}) });
    const w = domainPostfixWatcher(providerMock<DataSource>({ query }), postfix);
    await w.fn("999");
    expect(postfix.queueStats).toHaveBeenCalledWith(undefined);
  });
});

describe("domainQuotaWatcher", () => {
  it("returns an empty snapshot when the id matches no domain", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const w = domainQuotaWatcher(providerMock<DataSource>({ query }));
    await expect(w.fn("404")).resolves.toEqual({ domain: null, recipients: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("joins the domain counters with each recipient ceiling", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ domain: "x.io", quota: 1000 }])
      .mockResolvedValueOnce([{ bytes: 500, messages: 12, lastActivity: "2026-07-20T00:00:00.000Z" }])
      .mockResolvedValueOnce([{ id: 1, email: "a@x.io", bytes: 200, quota: 300 }]);
    const w = domainQuotaWatcher(providerMock<DataSource>({ query }));
    await expect(w.fn("3")).resolves.toEqual({
      domain: { bytes: "500", messages: "12", lastActivity: "2026-07-20T00:00:00.000Z", quota: "1000" },
      recipients: [{ id: 1, email: "a@x.io", bytes: "200", quota: "300" }],
    });
  });

  it("reports a null domain block when dovecot has no counters yet", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ domain: "x.io", quota: 1000 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const w = domainQuotaWatcher(providerMock<DataSource>({ query }));
    await expect(w.fn("3")).resolves.toEqual({ domain: null, recipients: [] });
  });
});

describe("domainRspamdWatcher", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns null when the id matches no domain", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const w = domainRspamdWatcher(providerMock<DataSource>({ query }));
    await expect(w.fn("404")).resolves.toBeNull();
  });

  it("tallies history actions and folds bayes learns over the domain mailboxes", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ domain: "x.io" }])
      .mockResolvedValueOnce([{ email: "a@x.io" }, { email: "b@x.io" }]);
    vi.spyOn(RspamdService.prototype, "history").mockResolvedValue([
      entity<RspamdHistoryRow>({ action: "reject" }),
      entity<RspamdHistoryRow>({ action: "no action" }),
      entity<RspamdHistoryRow>({ action: "bogus" }),
    ]);
    vi.spyOn(RspamdService.prototype, "domainBayes").mockResolvedValue({
      recipients: [{ recipient: "a@x.io", learnsHam: 4, learnsSpam: 1 }],
      totalHam: 4,
      totalSpam: 1,
    });
    const w = domainRspamdWatcher(providerMock<DataSource>({ query }));
    await expect(w.fn("3")).resolves.toEqual({
      scanned: 3,
      actions: { reject: 1, "soft reject": 0, "rewrite subject": 0, "add header": 0, greylist: 0, "no action": 1 },
      bayes: {
        recipients: [
          { recipient: "a@x.io", learnsHam: 4, learnsSpam: 1 },
          { recipient: "b@x.io", learnsHam: 0, learnsSpam: 0 },
        ],
        totalHam: 4,
        totalSpam: 1,
      },
    });
  });
});

describe("notificationsWatcher", () => {
  it("serves the notification feed of the subscriber id", async () => {
    const feed = [{ id: 1 }];
    const notifications = providerMock<NotificationsService>({ feed: vi.fn().mockResolvedValue(feed) });
    const w = notificationsWatcher(notifications);
    await expect(w.fn("user-1")).resolves.toBe(feed);
    expect(notifications.feed).toHaveBeenCalledWith("user-1");
  });
});

describe("postfixQueueWatcher", () => {
  it("relays the global postfix queue stats", async () => {
    const stats = { active: 2 };
    const postfix = providerMock<PostfixService>({ queueStats: vi.fn().mockResolvedValue(stats) });
    await expect(postfixQueueWatcher(postfix).fn()).resolves.toBe(stats);
    expect(postfix.queueStats).toHaveBeenCalledWith();
  });
});

describe("sessionsWatcher", () => {
  it("relays the sessions overview", async () => {
    const overview = [{ email: "a@x.io" }];
    const sessions = providerMock<JwtAuthService>({ listSessionsOverview: vi.fn().mockResolvedValue(overview) });
    await expect(sessionsWatcher(sessions).fn()).resolves.toBe(overview);
  });
});

describe("presenceWatcher", () => {
  it("authorizes every authenticated account to read presence", async () => {
    const presence = providerMock<AccountPresenceService>({ presenceState: vi.fn() });
    await expect(presenceWatcher(presence).authorize!({ userId: "u1", isRoot: false }, "")).resolves.toBe(true);
  });
});

describe("rspamdStatsWatcher", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed stat body when rspamd answers", async () => {
    const body = { scanned: 5 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));
    await expect(rspamdStatsWatcher().fn()).resolves.toBe(body);
  });

  it("returns null when rspamd answers with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(rspamdStatsWatcher().fn()).resolves.toBeNull();
  });
});

describe("supervisionWatcher", () => {
  // The poller IS the sampling loop: it must drive the recorder's own tick,
  // never read a value some second loop produced.
  it("drives the recorder's tick and publishes the snapshot it returns", async () => {
    const snapshot = { at: 1, cores: 8, cpu: null, load: { one: 0, five: 0, fifteen: 0 } };
    const tick = vi.fn().mockResolvedValue(snapshot);
    const watcher = supervisionWatcher(providerMock<SupervisionRecorderService>({ tick }));
    await expect(watcher.fn()).resolves.toBe(snapshot);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("polls at the cadence the live cards are drawn at", () => {
    const watcher = supervisionWatcher(providerMock<SupervisionRecorderService>({ tick: vi.fn() }));
    expect(watcher.intervalMs).toBe(SUPERVISION_INTERVAL_MS);
  });
});
