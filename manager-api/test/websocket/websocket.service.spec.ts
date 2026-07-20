import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { DataSource } from "typeorm";
import type { DomainsService } from "../../src/api/domains/domains.service";
import type { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import type { PostfixService } from "../../src/core/postfix/postfix.service";
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
    gateway = providerMock<WebsocketGateway>({ publish: vi.fn(), registerTopic: vi.fn(), setDynamicHandlers: vi.fn() });
    buildWatchers.mockReset();
  });

  afterEach(() => {
    service?.onModuleDestroy();
    vi.useRealTimers();
  });

  function start(watcher: Partial<Watcher> & Pick<Watcher, "fn">) {
    buildWatchers.mockReturnValue([{ topic: "t", permissions: PERMS, ...watcher }]);
    service = new WebsocketService(
      gateway,
      providerMock<DataSource>({}),
      providerMock<DomainsService>({}),
      providerMock<PostfixService>({}),
      providerMock<JwtAuthService>({})
    );
    service.onModuleInit();
  }

  it("registers each watcher's declared permissions and scope on the gateway", () => {
    start({ fn: () => 1 });
    expect(gateway.registerTopic).toHaveBeenCalledWith("t", { permissions: PERMS, scope: "global", parameterized: false });
  });

  it("does not poll a parameterized watcher until asked, then starts on demand", async () => {
    const fn = vi.fn(() => 1);
    buildWatchers.mockReturnValue([{ topic: "d", permissions: PERMS, scope: "domain", parameterized: true, fn }]);
    service = new WebsocketService(
      gateway,
      providerMock<DataSource>({}),
      providerMock<DomainsService>({}),
      providerMock<PostfixService>({}),
      providerMock<JwtAuthService>({})
    );
    const handlers = { start: (_f: string, _b: string, _p: string) => undefined, stop: (_f: string) => undefined };
    gateway.setDynamicHandlers.mockImplementation((h: typeof handlers) => Object.assign(handlers, h));
    service.onModuleInit();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).not.toHaveBeenCalled();

    handlers.start("d:42", "d", "42");
    await vi.advanceTimersByTimeAsync(0);
    expect(gateway.publish).toHaveBeenCalledExactlyOnceWith("d:42", 1);

    handlers.stop("d:42");
    await vi.advanceTimersByTimeAsync(5000);
    expect(gateway.publish).toHaveBeenCalledTimes(1);
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
