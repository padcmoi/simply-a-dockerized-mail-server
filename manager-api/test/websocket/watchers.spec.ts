import { describe, it, expect } from "vitest";
import type { DataSource } from "typeorm";
import type { DomainsService } from "../../src/api/domains/domains.service";
import type { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import type { PostfixService } from "../../src/core/postfix/postfix.service";
import type { NotificationsService } from "../../src/core/notifications/notifications.service";
import type { TicketsService } from "../../src/api/tickets/tickets.service";
import type { AccountPresenceService } from "../../src/core/websocket/account-presence.service";
import { buildWatchers } from "../../src/core/websocket/watchers";
import { MIN_INTERVAL_MS } from "../../src/core/websocket/watcher.type";
import { DOMAIN_ACTIONS, GLOBAL_ACTIONS } from "../../src/core/custom-permission-guard/permission-catalog";
import { providerMock } from "../helpers/mocks";

const watchers = buildWatchers({
  dataSource: {} as DataSource,
  domains: providerMock<DomainsService>({}),
  postfix: providerMock<PostfixService>({}),
  sessions: providerMock<JwtAuthService>({}),
  notifications: providerMock<NotificationsService>({}),
  tickets: providerMock<TicketsService>({}),
  presence: providerMock<AccountPresenceService>({}),
});

describe("websocket watchers", () => {
  it("exposes at least one topic", () => {
    expect(watchers.length).toBeGreaterThan(0);
  });

  it("never declares the same topic twice", () => {
    const topics = watchers.map((w) => w.topic);
    expect(topics).toEqual([...new Set(topics)]);
  });

  // Fail-closed contract: the gateway refuses any topic with no declared
  // permission, so a watcher shipping an empty list would simply be dead.
  // A "self" topic is the one exception: it carries the subscriber's own data
  // and is authorized on identity (param === userId), not on a permission.
  it.each(watchers.filter((w) => w.scope !== "self" && !w.authorize).map((w) => [w.topic, w] as const))(
    "%s declares at least one permission",
    (_topic, watcher) => {
      expect(watcher.permissions.length).toBeGreaterThan(0);
      for (const entry of watcher.permissions) expect(entry.actions.length).toBeGreaterThan(0);
    }
  );

  // An unparameterized "self" topic would have no identity to match against,
  // so the gateway would hand the same stream to every subscriber.
  it.each(watchers.filter((w) => w.scope === "self").map((w) => [w.topic, w] as const))(
    "%s is a parameterized self topic",
    (_topic, watcher) => {
      expect(watcher.parameterized).toBe(true);
    }
  );

  // A parameterized topic that owns its authorization answers per row, so it is
  // meaningless without the row id the subscriber asked for. A non-parameterized
  // authorized topic (e.g. presence) authorizes globally and needs no param.
  it.each(watchers.filter((w) => w.authorize && w.parameterized).map((w) => [w.topic, w] as const))(
    "%s keeps its parameter for its own authorization",
    (_topic, watcher) => {
      expect(watcher.parameterized).toBe(true);
    }
  );

  // A typo in a resource or action would silently deny every account forever
  // (assertOne throws on an unknown pair), so pin them to the catalog matching
  // the watcher's scope: domain-scoped topics against DOMAIN_ACTIONS, the rest
  // against GLOBAL_ACTIONS.
  it.each(watchers.map((w) => [w.topic, w] as const))("%s only uses permissions the catalog defines", (_topic, watcher) => {
    const catalog: Record<string, readonly string[]> = watcher.scope === "domain" ? DOMAIN_ACTIONS : GLOBAL_ACTIONS;
    for (const entry of watcher.permissions) {
      const actions = catalog[entry.resource];
      expect(actions, `unknown resource "${entry.resource}" for scope ${watcher.scope ?? "global"}`).toBeDefined();
      for (const action of entry.actions) {
        expect(actions, `unknown action "${entry.resource}:${action}"`).toContain(action);
      }
    }
  });

  it.each(watchers.map((w) => [w.topic, w] as const))("%s never asks for a poll faster than the floor", (_topic, watcher) => {
    if (watcher.intervalMs !== undefined) expect(watcher.intervalMs).toBeGreaterThanOrEqual(MIN_INTERVAL_MS);
  });

  it("gates rspamd-stats exactly like the REST route it mirrors", () => {
    const watcher = watchers.find((w) => w.topic === "rspamd-stats");
    expect(watcher?.permissions).toEqual([{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }]);
  });
});
