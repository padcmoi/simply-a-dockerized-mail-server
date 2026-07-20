import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException, Logger } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { WebSocket } from "ws";
import { WebsocketGateway } from "../../src/core/websocket/websocket.gateway";
import type { RefreshToken } from "../../src/core/entities/refresh-token.entity";
import { cpgMock, entity, providerMock, repoMock, type CpgMock, type Loose } from "../helpers/mocks";

const RSPAMD_STATS = [{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }];

type GuardCpg = CpgMock & { grantGlobal: (resource: string, ...actions: string[]) => void };

// Same controllable double as global-permission.guard.spec.ts: assertOne.global
// resolves only for a granted pair, so the gateway's real authorization branch
// runs unchanged against it.
function makeCpg(): GuardCpg {
  const cpg = cpgMock();
  const granted = new Set<string>();
  cpg.guard.assertOne.global.mockImplementation(async (_uid: string, resource: string, opts: { acrud: string[] }) => {
    for (const a of opts.acrud) if (!granted.has(`${resource}:${a}`)) throw new ForbiddenException(`Missing ${resource}:${a}`);
  });
  return Object.assign(cpg, {
    grantGlobal: (resource: string, ...actions: string[]) => actions.forEach((a) => granted.add(`${resource}:${a}`)),
  });
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type FakeSocket = Mutable<WebSocket> & {
  sent: string[];
  closedWith?: [number, string];
  topics?: Set<string>;
};

function makeSocket(): FakeSocket {
  const sent: string[] = [];
  const socket = providerMock<FakeSocket>({
    OPEN: 1,
    readyState: 1,
    sent,
    send: vi.fn((payload: string) => {
      sent.push(payload);
    }),
    close: vi.fn((code: number, reason: string) => {
      socket.closedWith = [code, reason];
      socket.readyState = 3;
    }),
  });
  return socket;
}

function frames(socket: FakeSocket) {
  return socket.sent.map((s) => JSON.parse(s) as { topic: string; data: unknown });
}

describe("WebsocketGateway", () => {
  let jwt: Loose<JwtService>;
  let cpg: GuardCpg;
  let refreshTokens: ReturnType<typeof repoMock<RefreshToken>>;
  let gateway: WebsocketGateway;

  beforeEach(() => {
    jwt = providerMock<JwtService>({ verifyAsync: vi.fn() });
    cpg = makeCpg();
    refreshTokens = repoMock<RefreshToken>();
    gateway = new WebsocketGateway(jwt, cpg, refreshTokens);
    gateway.registerTopic("rspamd-stats", RSPAMD_STATS);
  });

  async function connectAs(socket: FakeSocket, payload: Record<string, unknown>) {
    gateway.handleConnection(socket);
    jwt.verifyAsync.mockResolvedValue(payload);
    await gateway.onAuth(socket, { token: "any" });
  }

  describe("authentication", () => {
    it("closes a socket whose token cannot be verified", async () => {
      const socket = makeSocket();
      gateway.handleConnection(socket);
      jwt.verifyAsync.mockRejectedValue(new Error("bad signature"));

      await gateway.onAuth(socket, { token: "forged" });

      expect(socket.closedWith?.[0]).toBe(4001);
    });

    it("refuses a token whose session was revoked", async () => {
      const socket = makeSocket();
      refreshTokens.findOne.mockResolvedValue(
        entity<RefreshToken>({ id: 7, revokedAt: new Date("2020-01-01"), expiresAt: new Date("2999-01-01") })
      );
      await connectAs(socket, { sub: "u1", email: "u@test", isRoot: true, sid: 7 });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(frames(socket)).toEqual([]);
    });

    it("refuses a token whose session expired", async () => {
      const socket = makeSocket();
      refreshTokens.findOne.mockResolvedValue(
        entity<RefreshToken>({ id: 7, revokedAt: null, expiresAt: new Date("2000-01-01") })
      );
      await connectAs(socket, { sub: "u1", email: "u@test", isRoot: true, sid: 7 });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(frames(socket)).toEqual([]);
    });

    it("refuses a token whose session no longer exists", async () => {
      const socket = makeSocket();
      refreshTokens.findOne.mockResolvedValue(null);
      await connectAs(socket, { sub: "u1", email: "u@test", isRoot: true, sid: 7 });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(frames(socket)).toEqual([]);
    });

    it("accepts a live session", async () => {
      const socket = makeSocket();
      refreshTokens.findOne.mockResolvedValue(
        entity<RefreshToken>({ id: 7, revokedAt: null, expiresAt: new Date("2999-01-01") })
      );
      await connectAs(socket, { sub: "u1", email: "u@test", isRoot: true, sid: 7 });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });
      gateway.publish("rspamd-stats", { scanned: 1 });

      expect(frames(socket)).toEqual([{ topic: "rspamd-stats", data: { scanned: 1 } }]);
    });

    it("accepts a legacy token carrying no session id without touching the repository", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u@test", isRoot: true });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(refreshTokens.findOne).not.toHaveBeenCalled();
      expect(socket.topics?.has("rspamd-stats")).toBe(true);
    });
  });

  describe("topic authorization", () => {
    it("denies an account missing the topic's permission", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "nobody@test", isRoot: false });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });
      gateway.publish("rspamd-stats", { scanned: 1 });

      expect(frames(socket)).toEqual([]);
    });

    it("denies an account holding only part of the required actions", async () => {
      const socket = makeSocket();
      cpg.grantGlobal("rspamd", "access");
      await connectAs(socket, { sub: "u1", email: "half@test", isRoot: false });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(socket.topics?.has("rspamd-stats")).toBe(false);
    });

    it("allows an account holding every required action", async () => {
      const socket = makeSocket();
      cpg.grantGlobal("rspamd", "access", "view-rspamd-stats");
      await connectAs(socket, { sub: "u1", email: "ok@test", isRoot: false });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });
      gateway.publish("rspamd-stats", { scanned: 2 });

      expect(frames(socket)).toEqual([{ topic: "rspamd-stats", data: { scanned: 2 } }]);
    });

    it("lets root through without consulting the permission library", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(cpg.guard.assertOne.global).not.toHaveBeenCalled();
      expect(socket.topics?.has("rspamd-stats")).toBe(true);
    });

    it("refuses an unregistered topic even for root (fail-closed)", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });

      await gateway.onSubscribe(socket, { topic: "not-declared" });
      gateway.publish("not-declared", { leak: true });

      expect(frames(socket)).toEqual([]);
    });

    it("ignores a subscribe sent before any auth message", async () => {
      const socket = makeSocket();
      gateway.handleConnection(socket);

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(socket.topics?.has("rspamd-stats")).toBe(false);
    });
  });

  describe("consumer logging", () => {
    it("stays silent unless MANAGER_WS_LOG is on", async () => {
      vi.stubEnv("MANAGER_WS_LOG", "false");
      const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      const socket = makeSocket();
      await connectAs(socket, { sub: "a", email: "a@test", isRoot: true });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });
      gateway.onUnsubscribe(socket, { topic: "rspamd-stats" });

      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
      vi.unstubAllEnvs();
    });

    it("logs both ends of a subscription when MANAGER_WS_LOG is on", async () => {
      vi.stubEnv("MANAGER_WS_LOG", "true");
      const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      const socket = makeSocket();
      await connectAs(socket, { sub: "a", email: "a@test", isRoot: true });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });
      gateway.onUnsubscribe(socket, { topic: "rspamd-stats" });

      expect(log.mock.calls.map((c) => String(c[0]))).toEqual([
        '+ a@test consumes "rspamd-stats" (1 consumer(s))',
        '- a@test stopped consuming "rspamd-stats" (0 consumer(s) left)',
      ]);
      log.mockRestore();
      vi.unstubAllEnvs();
    });
  });

  describe("publish routing", () => {
    it("sends only to subscribers of that topic", async () => {
      const subscriber = makeSocket();
      const bystander = makeSocket();
      await connectAs(subscriber, { sub: "a", email: "a@test", isRoot: true });
      await connectAs(bystander, { sub: "b", email: "b@test", isRoot: true });
      await gateway.onSubscribe(subscriber, { topic: "rspamd-stats" });

      gateway.publish("rspamd-stats", { scanned: 3 });

      expect(frames(subscriber)).toEqual([{ topic: "rspamd-stats", data: { scanned: 3 } }]);
      expect(frames(bystander)).toEqual([]);
    });

    it("replays the last known value on subscribe", async () => {
      gateway.publish("rspamd-stats", { scanned: 9 });
      const socket = makeSocket();
      await connectAs(socket, { sub: "a", email: "a@test", isRoot: true });

      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      expect(frames(socket)).toEqual([{ topic: "rspamd-stats", data: { scanned: 9 } }]);
    });

    it("stops sending after unsubscribe", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "a", email: "a@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      gateway.onUnsubscribe(socket, { topic: "rspamd-stats" });
      gateway.publish("rspamd-stats", { scanned: 4 });

      expect(frames(socket)).toEqual([]);
    });

    it("stops sending to a disconnected client", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "a", email: "a@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });

      gateway.handleDisconnect(socket);
      gateway.publish("rspamd-stats", { scanned: 5 });

      expect(frames(socket)).toEqual([]);
    });

    it("skips a socket that is no longer open", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "a", email: "a@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "rspamd-stats" });
      socket.readyState = 3;

      gateway.publish("rspamd-stats", { scanned: 6 });

      expect(frames(socket)).toEqual([]);
    });
  });
});
