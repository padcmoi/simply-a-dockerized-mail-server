import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { Repository } from "typeorm";
import type { WebSocket } from "ws";
import type { JwtPayload } from "../auth/jwt/jwt.strategy";
import { CustomPermissionGuardService } from "../custom-permission-guard/custom-permission-guard.service";
import { RefreshToken } from "../entities/refresh-token.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { TopicPresenceService } from "./presence.service";
import type { TopicCaller, TopicPermission, TopicScope } from "./watcher.type";

const WS_PORT = 3001;
const AUTH_TIMEOUT_MS = 5_000;

type AuthSocket = WebSocket & {
  auth?: Promise<boolean>;
  topics?: Set<string>;
  userId?: string;
  isRoot?: boolean;
  who?: string;
};

interface TopicMeta {
  permissions: TopicPermission[];
  scope: TopicScope;
  parameterized: boolean;
  authorize?: (caller: TopicCaller, param: string) => Promise<boolean>;
}

export interface DynamicHandlers {
  start(fullTopic: string, base: string, param: string): void;
  stop(fullTopic: string): void;
}

@WebSocketGateway(WS_PORT)
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(WebsocketGateway.name);
  private readonly clients = new Set<AuthSocket>();
  private readonly latest = new Map<string, unknown>();
  private readonly topics = new Map<string, TopicMeta>();
  private dynamic: DynamicHandlers | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly cpg: CustomPermissionGuardService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    private readonly presence: TopicPresenceService
  ) {}

  private get logsConsumers() {
    return process.env.MANAGER_WS_LOG === "true";
  }

  registerTopic(topic: string, meta: TopicMeta) {
    this.topics.set(topic, meta);
  }

  setDynamicHandlers(handlers: DynamicHandlers) {
    this.dynamic = handlers;
  }

  handleConnection(client: AuthSocket) {
    client.topics = new Set();
    client.who = "anonymous";
    this.clients.add(client);
    setTimeout(() => {
      if (!client.auth) client.close(4001, "auth timeout");
    }, AUTH_TIMEOUT_MS);
  }

  handleDisconnect(client: AuthSocket) {
    this.clients.delete(client);
    const dropped = [...(client.topics ?? [])];
    client.topics?.clear();
    for (const fullTopic of dropped) {
      if (client.userId) this.presence.leave(client.userId, fullTopic);
      this.onTopicLeft(fullTopic);
    }
    if (this.logsConsumers && dropped.length) {
      this.log.log(`- ${client.who} disconnected, stopped consuming [${dropped.join(", ")}]`);
    }
  }

  @SubscribeMessage("auth")
  async onAuth(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { token?: string }) {
    client.auth = this.verify(client, data?.token ?? "").catch(() => {
      client.close(4001, "unauthorized");
      return false;
    });
    await client.auth;
  }

  private async verify(client: AuthSocket, token: string) {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret: process.env.MANAGER_JWT_ACCESS_SECRET });
    if (!payload.sub) return false;
    if (payload.sid !== undefined) {
      const session = await this.refreshTokens.findOne({ where: { id: payload.sid } });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) return false;
    }
    client.userId = payload.sub;
    client.isRoot = payload.isRoot === true;
    client.who = payload.email ?? payload.sub;
    return true;
  }

  @SubscribeMessage("subscribe")
  async onSubscribe(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { topic?: string }) {
    const fullTopic = data?.topic;
    if (!fullTopic || !(await client.auth) || !client.userId) return;
    const { base, param } = this.split(fullTopic);
    const meta = this.topics.get(base);
    if (!meta || meta.parameterized !== (param !== undefined)) return this.deny(client, fullTopic);
    if (!(await this.mayConsume(client, meta, param))) return this.deny(client, fullTopic);

    const first = this.subscriberCount(fullTopic) === 0;
    if (!client.topics?.has(fullTopic)) this.presence.join(client.userId, fullTopic);
    client.topics?.add(fullTopic);
    if (meta.parameterized && first) this.dynamic?.start(fullTopic, base, param as string);
    if (this.logsConsumers)
      this.log.log(`+ ${client.who} consumes "${fullTopic}" (${this.subscriberCount(fullTopic)} consumer(s))`);
    if (this.latest.has(fullTopic)) this.send(client, fullTopic, this.latest.get(fullTopic));
  }

  @SubscribeMessage("unsubscribe")
  onUnsubscribe(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { topic?: string }) {
    const fullTopic = data?.topic;
    if (!fullTopic || !client.topics?.delete(fullTopic)) return;
    if (client.userId) this.presence.leave(client.userId, fullTopic);
    this.onTopicLeft(fullTopic);
    if (this.logsConsumers)
      this.log.log(`- ${client.who} stopped consuming "${fullTopic}" (${this.subscriberCount(fullTopic)} consumer(s) left)`);
  }

  // Last subscriber of a parameterized topic gone: stop its poller and drop the
  // cached value so a later re-subscribe starts fresh and the map stays bounded.
  private onTopicLeft(fullTopic: string) {
    const { base } = this.split(fullTopic);
    const meta = this.topics.get(base);
    if (meta?.parameterized && this.subscriberCount(fullTopic) === 0) {
      this.dynamic?.stop(fullTopic);
      this.latest.delete(fullTopic);
    }
  }

  private deny(client: AuthSocket, fullTopic: string) {
    if (this.logsConsumers) this.log.warn(`x ${client.who} denied on "${fullTopic}"`);
  }

  private split(fullTopic: string): { base: string; param?: string } {
    const i = fullTopic.indexOf(":");
    return i === -1 ? { base: fullTopic } : { base: fullTopic.slice(0, i), param: fullTopic.slice(i + 1) };
  }

  // A "self" topic carries one account's own data, so it is keyed by identity,
  // not by permission: it is checked before the root bypass, otherwise root
  // would be able to read another account's stream.
  private async mayConsume(client: AuthSocket, meta: TopicMeta, param?: string) {
    if (meta.authorize) {
      return meta.authorize({ userId: client.userId!, isRoot: client.isRoot === true }, param ?? "");
    }
    if (meta.scope === "self") return param === client.userId;
    if (client.isRoot) return true;
    return meta.scope === "domain" ? this.mayConsumeDomain(client, meta, param) : this.mayConsumeGlobal(client, meta);
  }

  private async mayConsumeGlobal(client: AuthSocket, meta: TopicMeta) {
    try {
      for (const entry of meta.permissions) {
        await this.cpg.guard.assertOne.global(client.userId!, entry.resource, { acrud: entry.actions });
      }
      return true;
    } catch {
      return false;
    }
  }

  // Mirrors DomainPermissionGuard: owner-bypass, the domains:access prerequisite,
  // the "domain" resource access, then each declared domain permission.
  private async mayConsumeDomain(client: AuthSocket, meta: TopicMeta, param?: string) {
    const domainId = Number(param);
    if (!Number.isFinite(domainId)) return false;
    const domain = await this.domains.findOne({ where: { id: domainId } });
    if (domain && domain.ownerId === client.userId) return true;
    try {
      await this.cpg.guard.assertOne.global(client.userId!, "domains", { acrud: ["access"] });
      await this.cpg.guard.assertOne.domain(client.userId!, domainId, "domain", { acrud: ["access"] });
      for (const entry of meta.permissions) {
        await this.cpg.guard.assertOne.domain(client.userId!, domainId, entry.resource, { acrud: entry.actions });
      }
      return true;
    } catch {
      return false;
    }
  }

  publish(topic: string, data: unknown) {
    this.latest.set(topic, data);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN && client.topics?.has(topic)) this.send(client, topic, data);
    }
  }

  private subscriberCount(topic: string) {
    let n = 0;
    for (const client of this.clients) if (client.topics?.has(topic)) n++;
    return n;
  }

  private send(client: AuthSocket, topic: string, data: unknown) {
    client.send(JSON.stringify({ topic, data }));
  }
}
