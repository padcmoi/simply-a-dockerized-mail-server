import { describe, it, expect } from "vitest";
import type { DataSource } from "typeorm";
import { buildWatchers } from "../../src/core/websocket/watchers";
import { MIN_INTERVAL_MS } from "../../src/core/websocket/watcher.type";
import { GLOBAL_ACTIONS } from "../../src/core/custom-permission-guard/permission-catalog";

const watchers = buildWatchers({} as DataSource);

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
  it.each(watchers.map((w) => [w.topic, w] as const))("%s declares at least one permission", (_topic, watcher) => {
    expect(watcher.permissions.length).toBeGreaterThan(0);
    for (const entry of watcher.permissions) expect(entry.actions.length).toBeGreaterThan(0);
  });

  // A typo in a resource or action would silently deny every account forever
  // (assertOne.global throws on an unknown pair), so pin them to the catalog.
  it.each(watchers.map((w) => [w.topic, w] as const))("%s only uses permissions the catalog defines", (_topic, watcher) => {
    for (const entry of watcher.permissions) {
      const actions = GLOBAL_ACTIONS[entry.resource as keyof typeof GLOBAL_ACTIONS] as readonly string[] | undefined;
      expect(actions, `unknown resource "${entry.resource}"`).toBeDefined();
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
