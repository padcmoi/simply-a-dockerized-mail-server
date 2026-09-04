import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException, Logger } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { WebSocket } from "ws";
import { AccountPresenceService } from "../../src/core/websocket/account-presence.service";
import { PresenceActivityService } from "../../src/core/websocket/presence-activity.service";
import { TopicPresenceService } from "../../src/core/websocket/presence.service";
import { WebsocketGateway } from "../../src/core/websocket/websocket.gateway";
import type { RefreshToken } from "../../src/core/entities/refresh-token.entity";
import type { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { cpgMock, entity, providerMock, repoMock, type CpgMock, type Loose } from "../helpers/mocks";

const RSPAMD_STATS = [{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }];

type GuardCpg = CpgMock & {
  grantGlobal: (resource: string, ...actions: string[]) => void;
  grantDomain: (domainId: number, resource: string, ...actions: string[]) => void;
};

// Same controllable double as global-permission.guard.spec.ts: assertOne.global
// resolves only for a granted pair, so the gateway's real authorization branch
// runs unchanged against it. assertOne.domain mirrors it for domain-scoped topics.
function makeCpg(): GuardCpg {
  const cpg = cpgMock();
  const granted = new Set<string>();
  const grantedDomain = new Set<string>();
  cpg.guard.assertOne.global.mockImplementation(async (_uid: string, resource: string, opts: { acrud: string[] }) => {
    for (const a of opts.acrud) if (!granted.has(`${resource}:${a}`)) throw new ForbiddenException(`Missing ${resource}:${a}`);
  });
  cpg.guard.assertOne.domain.mockImplementation(
    async (_uid: string, domainId: number, resource: string, opts: { acrud: string[] }) => {
      for (const a of opts.acrud)
        if (!grantedDomain.has(`${domainId}:${resource}:${a}`))
          throw new ForbiddenException(`Missing ${domainId}:${resource}:${a}`);
    }
  );
  return Object.assign(cpg, {
    grantGlobal: (resource: string, ...actions: string[]) => actions.forEach((a) => granted.add(`${resource}:${a}`)),
    grantDomain: (domainId: number, resource: string, ...actions: string[]) =>
      actions.forEach((a) => grantedDomain.add(`${domainId}:${resource}:${a}`)),
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
  let domains: ReturnType<typeof repoMock<VirtualDomain>>;
  let presence: TopicPresenceService;
  let activity: PresenceActivityService;
  let accountPresence: Loose<AccountPresenceService>;
  let gateway: WebsocketGateway;

  beforeEach(() => {
    jwt = providerMock<JwtService>({ verifyAsync: vi.fn() });
    cpg = makeCpg();
    refreshTokens = repoMock<RefreshToken>();
    domains = repoMock<VirtualDomain>();
    presence = new TopicPresenceService();
    activity = new PresenceActivityService();
    accountPresence = providerMock<AccountPresenceService>({ setStatus: vi.fn().mockResolvedValue(undefined) });
    gateway = new WebsocketGateway(jwt, cpg, refreshTokens, domains, presence, activity, accountPresence);
    gateway.registerTopic("rspamd-stats", { permissions: RSPAMD_STATS, scope: "global", parameterized: false });
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

  describe("self-scoped topics", () => {
    beforeEach(() => {
      gateway.registerTopic("notifications", { permissions: [], scope: "self", parameterized: true });
      gateway.setDynamicHandlers({ start: vi.fn(), stop: vi.fn() });
    });

    it("lets an account consume its own stream with no permission at all", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "notifications:u1" });
      expect(socket.topics?.has("notifications:u1")).toBe(true);
      expect(cpg.guard.assertOne.global).not.toHaveBeenCalled();
    });

    it("denies an account asking for someone else's stream", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "notifications:u2" });
      expect(socket.topics?.has("notifications:u2")).toBe(false);
    });

    // Identity, not permission: the root bypass must not apply here, or root
    // would read every account's private stream.
    it("denies root on another account's stream", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "notifications:u1" });
      expect(socket.topics?.has("notifications:u1")).toBe(false);
    });

    it("still lets root consume its own stream", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "notifications:root" });
      expect(socket.topics?.has("notifications:root")).toBe(true);
    });

    it("denies a self topic carrying no param", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "notifications" });
      expect(socket.topics?.has("notifications")).toBe(false);
    });

    it("keeps two accounts' streams apart on publish", async () => {
      const a = makeSocket();
      const b = makeSocket();
      await connectAs(a, { sub: "u1", email: "u1@test", isRoot: false });
      await connectAs(b, { sub: "u2", email: "u2@test", isRoot: false });
      await gateway.onSubscribe(a, { topic: "notifications:u1" });
      await gateway.onSubscribe(b, { topic: "notifications:u2" });

      gateway.publish("notifications:u1", { unread: 3 });

      expect(frames(a)).toEqual([{ topic: "notifications:u1", data: { unread: 3 } }]);
      expect(frames(b)).toEqual([]);
    });
  });

  describe("row-authorized topics", () => {
    let authorize: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      authorize = vi.fn().mockResolvedValue(true);
      gateway.registerTopic("ticket", { permissions: [], scope: "global", parameterized: true, authorize });
      gateway.setDynamicHandlers({ start: vi.fn(), stop: vi.fn() });
    });

    it("hands the decision to the watcher, with the caller and the row id", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      expect(authorize).toHaveBeenCalledWith({ userId: "u1", isRoot: false }, "9");
      expect(socket.topics?.has("ticket:9")).toBe(true);
    });

    it("denies when the watcher refuses the row", async () => {
      authorize.mockResolvedValue(false);
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      expect(socket.topics?.has("ticket:9")).toBe(false);
    });

    // The catalog cannot express a row rule, so root must go through the
    // watcher too instead of being waved past it.
    it("asks the watcher even for root", async () => {
      authorize.mockResolvedValue(false);
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      expect(authorize).toHaveBeenCalledWith({ userId: "root", isRoot: true }, "9");
      expect(socket.topics?.has("ticket:9")).toBe(false);
    });

    it("records presence on subscribe and clears it on unsubscribe", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      expect(presence.watchers("ticket:9")).toEqual(new Set(["u1"]));
      gateway.onUnsubscribe(socket, { topic: "ticket:9" });
      expect(presence.watchers("ticket:9")).toEqual(new Set());
    });

    it("clears presence when the socket drops without unsubscribing", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      gateway.handleDisconnect(socket);
      expect(presence.watchers("ticket:9")).toEqual(new Set());
    });

    it("keeps an account present while one of its two tabs is still open", async () => {
      const a = makeSocket();
      const b = makeSocket();
      await connectAs(a, { sub: "u1", email: "u1@test", isRoot: false });
      await connectAs(b, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(a, { topic: "ticket:9" });
      await gateway.onSubscribe(b, { topic: "ticket:9" });
      gateway.handleDisconnect(a);
      expect(presence.watchers("ticket:9")).toEqual(new Set(["u1"]));
      gateway.handleDisconnect(b);
      expect(presence.watchers("ticket:9")).toEqual(new Set());
    });

    it("does not double-count a repeated subscribe from the same socket", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      gateway.onUnsubscribe(socket, { topic: "ticket:9" });
      expect(presence.watchers("ticket:9")).toEqual(new Set());
    });
  });

  describe("idle activity", () => {
    async function authed(sub: string) {
      const socket = makeSocket();
      await connectAs(socket, { sub, email: `${sub}@test`, isRoot: false });
      return socket;
    }

    it("registers a fresh socket as active", async () => {
      await authed("u1");
      expect(activity.awayUserIds().has("u1")).toBe(false);
    });

    // The table is the single source every consumer reads, so each socket event
    // must land in it, not just in memory.
    it("writes the account online in the presence table on authentication", async () => {
      await authed("u1");
      expect(accountPresence.setStatus).toHaveBeenCalledWith("u1", true);
    });

    it("writes it offline when it goes idle", async () => {
      const a = await authed("u1");
      accountPresence.setStatus.mockClear();
      await gateway.onActivity(a, { idle: true });
      expect(accountPresence.setStatus).toHaveBeenCalledWith("u1", false);
    });

    it("writes it back online when activity resumes", async () => {
      const a = await authed("u1");
      await gateway.onActivity(a, { idle: true });
      accountPresence.setStatus.mockClear();
      await gateway.onActivity(a, { idle: false });
      expect(accountPresence.setStatus).toHaveBeenCalledWith("u1", true);
    });

    it("writes it offline when its last socket drops", async () => {
      const a = await authed("u1");
      accountPresence.setStatus.mockClear();
      gateway.handleDisconnect(a);
      expect(accountPresence.setStatus).toHaveBeenCalledWith("u1", false);
    });

    it("keeps it online while another socket remains", async () => {
      const a = await authed("u1");
      await authed("u1");
      accountPresence.setStatus.mockClear();
      gateway.handleDisconnect(a);
      expect(accountPresence.setStatus).toHaveBeenCalledWith("u1", true);
    });

    it("marks the account away once its only socket goes idle", async () => {
      const a = await authed("u1");
      await gateway.onActivity(a, { idle: true });
      expect(activity.awayUserIds().has("u1")).toBe(true);
    });

    it("brings it back the moment activity resumes", async () => {
      const a = await authed("u1");
      await gateway.onActivity(a, { idle: true });
      await gateway.onActivity(a, { idle: false });
      expect(activity.awayUserIds().has("u1")).toBe(false);
    });

    // Two tabs: one idle, one active keeps the account present.
    it("stays present while any of its sockets is active", async () => {
      const a = await authed("u1");
      const b = await authed("u1");
      await gateway.onActivity(a, { idle: true });
      expect(activity.awayUserIds().has("u1")).toBe(false);
      await gateway.onActivity(b, { idle: true });
      expect(activity.awayUserIds().has("u1")).toBe(true);
    });

    it("clears activity when the socket drops", async () => {
      const a = await authed("u1");
      await gateway.onActivity(a, { idle: true });
      gateway.handleDisconnect(a);
      expect(activity.awayUserIds().has("u1")).toBe(false);
    });

    it("ignores an activity signal from an unauthenticated socket", async () => {
      const anon = makeSocket();
      gateway.handleConnection(anon);
      await gateway.onActivity(anon, { idle: true });
      expect(activity.awayUserIds().size).toBe(0);
    });
  });

  describe("presence bookkeeping", () => {
    it("isWatching reflects join and leave", () => {
      const svc = new TopicPresenceService();
      expect(svc.isWatching("u1", "t")).toBe(false);
      svc.join("u1", "t");
      expect(svc.isWatching("u1", "t")).toBe(true);
      svc.leave("u1", "t");
      expect(svc.isWatching("u1", "t")).toBe(false);
    });
  });

  describe("liveness", () => {
    it("answers a ping so a half-open socket can be told apart from a quiet one", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      socket.sent.length = 0;
      gateway.onPing(socket);
      expect(frames(socket)).toEqual([{ topic: "#pong", data: null }]);
    });

    it("stays silent on a socket that is no longer open", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "u1@test", isRoot: false });
      socket.sent.length = 0;
      socket.readyState = 3;
      gateway.onPing(socket);
      expect(frames(socket)).toEqual([]);
    });
  });

  describe("typing signal", () => {
    beforeEach(() => {
      gateway.registerTopic("ticket", {
        permissions: [],
        scope: "global",
        parameterized: true,
        authorize: () => Promise.resolve(true),
      });
      gateway.setDynamicHandlers({ start: vi.fn(), stop: vi.fn() });
    });

    async function subscribed(sub: string) {
      const socket = makeSocket();
      await connectAs(socket, { sub, email: `${sub}@test`, isRoot: false });
      await gateway.onSubscribe(socket, { topic: "ticket:9" });
      socket.sent.length = 0;
      return socket;
    }

    it("relays the signal to the other subscribers of that thread", async () => {
      const a = await subscribed("u1");
      const b = await subscribed("u2");
      await gateway.onTyping(a, { topic: "ticket:9" });
      expect(frames(b)).toEqual([{ topic: "ticket:9#typing", data: { userId: "u1", who: "u1@test", at: expect.any(Number) } }]);
    });

    it("never echoes the signal back to its sender", async () => {
      const a = await subscribed("u1");
      await gateway.onTyping(a, { topic: "ticket:9" });
      expect(frames(a)).toEqual([]);
    });

    it("does not leak to a subscriber of another thread", async () => {
      const a = await subscribed("u1");
      const other = makeSocket();
      await connectAs(other, { sub: "u3", email: "u3@test", isRoot: false });
      await gateway.onSubscribe(other, { topic: "ticket:42" });
      other.sent.length = 0;
      await gateway.onTyping(a, { topic: "ticket:9" });
      expect(frames(other)).toEqual([]);
    });

    // Sending requires being subscribed, which is where authorization happened:
    // an account cannot announce itself on a thread it may not read.
    it("ignores a signal on a topic the sender never subscribed to", async () => {
      const a = await subscribed("u1");
      const b = await subscribed("u2");
      await gateway.onTyping(a, { topic: "ticket:42" });
      expect(frames(b)).toEqual([]);
    });

    it("ignores a signal from a socket that never authenticated", async () => {
      const b = await subscribed("u2");
      const anon = makeSocket();
      gateway.handleConnection(anon);
      await gateway.onTyping(anon, { topic: "ticket:9" });
      expect(frames(b)).toEqual([]);
    });
  });

  describe("parameterized domain topics", () => {
    const DOMAIN_PERMS = [{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }];
    let dynamic: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      gateway.registerTopic("domain-rspamd", { permissions: DOMAIN_PERMS, scope: "domain", parameterized: true });
      dynamic = { start: vi.fn(), stop: vi.fn() };
      gateway.setDynamicHandlers(dynamic);
    });

    it("requires a param for a parameterized topic", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "domain-rspamd" });
      expect(socket.topics?.has("domain-rspamd")).toBe(false);
    });

    it("rejects a param on a non-parameterized topic", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "rspamd-stats:42" });
      expect(socket.topics?.has("rspamd-stats:42")).toBe(false);
    });

    it("lets root consume any domain and starts the poller on first subscribe", async () => {
      const socket = makeSocket();
      await connectAs(socket, { sub: "root", email: "root@test", isRoot: true });
      await gateway.onSubscribe(socket, { topic: "domain-rspamd:42" });
      expect(socket.topics?.has("domain-rspamd:42")).toBe(true);
      expect(dynamic.start).toHaveBeenCalledWith("domain-rspamd:42", "domain-rspamd", "42");
    });

    it("lets the domain owner consume without any group permission", async () => {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 42, ownerId: "u1" }));
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "owner@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "domain-rspamd:42" });
      expect(socket.topics?.has("domain-rspamd:42")).toBe(true);
    });

    it("lets a non-owner with the domain permission consume", async () => {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 42, ownerId: "someone-else" }));
      cpg.grantGlobal("domains", "access");
      cpg.grantDomain(42, "domain", "access");
      cpg.grantDomain(42, "rspamd", "access", "view-rspamd-stats");
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "member@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "domain-rspamd:42" });
      expect(socket.topics?.has("domain-rspamd:42")).toBe(true);
    });

    it("denies a non-owner lacking the domain permission", async () => {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 42, ownerId: "someone-else" }));
      cpg.grantGlobal("domains", "access");
      cpg.grantDomain(42, "domain", "access");
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "member@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "domain-rspamd:42" });
      expect(socket.topics?.has("domain-rspamd:42")).toBe(false);
    });

    it("denies when the domains:access prerequisite is missing", async () => {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 42, ownerId: "someone-else" }));
      cpg.grantDomain(42, "domain", "access");
      cpg.grantDomain(42, "rspamd", "access", "view-rspamd-stats");
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "member@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "domain-rspamd:42" });
      expect(socket.topics?.has("domain-rspamd:42")).toBe(false);
    });

    it("scopes ownership per domain: owning 42 does not grant 99", async () => {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 99, ownerId: "someone-else" }));
      const socket = makeSocket();
      await connectAs(socket, { sub: "u1", email: "owner-of-42@test", isRoot: false });
      await gateway.onSubscribe(socket, { topic: "domain-rspamd:99" });
      expect(socket.topics?.has("domain-rspamd:99")).toBe(false);
    });

    it("stops the poller only when the last subscriber of that instance leaves", async () => {
      const a = makeSocket();
      const b = makeSocket();
      await connectAs(a, { sub: "root", email: "a@test", isRoot: true });
      await connectAs(b, { sub: "root", email: "b@test", isRoot: true });
      await gateway.onSubscribe(a, { topic: "domain-rspamd:42" });
      await gateway.onSubscribe(b, { topic: "domain-rspamd:42" });
      expect(dynamic.start).toHaveBeenCalledTimes(1);

      gateway.onUnsubscribe(a, { topic: "domain-rspamd:42" });
      expect(dynamic.stop).not.toHaveBeenCalled();

      gateway.onUnsubscribe(b, { topic: "domain-rspamd:42" });
      expect(dynamic.stop).toHaveBeenCalledWith("domain-rspamd:42");
    });
  });
});
