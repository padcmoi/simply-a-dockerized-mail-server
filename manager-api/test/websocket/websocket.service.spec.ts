import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { DataSource } from "typeorm";
import type { Watcher } from "../../src/core/websocket/watcher.type";
import type { WebsocketGateway } from "../../src/core/websocket/websocket.gateway";
import { MIN_INTERVAL_MS } from "../../src/core/websocket/watcher.type";
import { WebsocketService } from "../../src/core/websocket/websocket.service";
import { providerMock, type Loose } from "../helpers/mocks";

const buildWatchers = vi.hoisted(() => vi.fn());

vi.mock("../../src/core/websocket/watchers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/websocket/watchers")>();
  return { ...actual, buildWatchers };
});

const PERMS = [{ resource: "rspamd", actions: ["access"] }];

describe("WebsocketService", () => {
  let gateway: Loose<WebsocketGateway>;
  let service: WebsocketService;

  beforeEach(() => {
    vi.useFakeTimers();
    gateway = providerMock<WebsocketGateway>({ publish: vi.fn(), registerTopic: vi.fn() });
    buildWatchers.mockReset();
  });

  afterEach(() => {
    service?.onModuleDestroy();
    vi.useRealTimers();
  });

  function start(watcher: Partial<Watcher> & Pick<Watcher, "fn">) {
    buildWatchers.mockReturnValue([{ topic: "t", permissions: PERMS, ...watcher }]);
    service = new WebsocketService(gateway, providerMock<DataSource>({}));
    service.onModuleInit();
  }

  it("registers each watcher's declared permissions on the gateway", () => {
    start({ fn: () => 1 });
    expect(gateway.registerTopic).toHaveBeenCalledWith("t", PERMS);
  });

  it("publishes the first polled value", async () => {
    start({ fn: () => "a" });
    await vi.advanceTimersByTimeAsync(0);
    expect(gateway.publish).toHaveBeenCalledExactlyOnceWith("t", "a");
  });

  it("does not republish an unchanged value", async () => {
    start({ intervalMs: 1000, fn: () => "same" });
    await vi.advanceTimersByTimeAsync(3500);
    expect(gateway.publish).toHaveBeenCalledTimes(1);
  });

  it("publishes again as soon as the value changes", async () => {
    let n = 0;
    start({ intervalMs: 1000, fn: () => ++n });
    await vi.advanceTimersByTimeAsync(2000);
    expect(gateway.publish.mock.calls.map((c: unknown[]) => c[1])).toEqual([1, 2, 3]);
  });

  it("compares by value, not by reference, so an equal object is not republished", async () => {
    start({ intervalMs: 1000, fn: () => ({ scanned: 1 }) });
    await vi.advanceTimersByTimeAsync(3000);
    expect(gateway.publish).toHaveBeenCalledTimes(1);
  });

  it("clamps an interval below the floor instead of hammering", async () => {
    let n = 0;
    start({ intervalMs: 1, fn: () => ++n });
    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS - 1);
    expect(gateway.publish).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(gateway.publish).toHaveBeenCalledTimes(2);
  });

  it("keeps polling after a failing watcher instead of dying", async () => {
    let n = 0;
    start({
      intervalMs: 1000,
      fn: () => {
        if (++n === 2) throw new Error("redis down");
        return n;
      },
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(gateway.publish.mock.calls.map((c: unknown[]) => c[1])).toEqual([1, 3]);
  });

  it("stops every timer on destroy", async () => {
    let n = 0;
    start({ intervalMs: 1000, fn: () => ++n });
    await vi.advanceTimersByTimeAsync(0);
    service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect(gateway.publish).toHaveBeenCalledTimes(1);
  });
});
