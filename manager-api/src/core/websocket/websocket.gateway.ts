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
import type { TopicPermission } from "./watcher.type";

const WS_PORT = 3001;
const AUTH_TIMEOUT_MS = 5_000;

type AuthSocket = WebSocket & {
  auth?: Promise<boolean>;
  topics?: Set<string>;
  userId?: string;
  isRoot?: boolean;
  who?: string;
};

@WebSocketGateway(WS_PORT)
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(WebsocketGateway.name);
  private readonly clients = new Set<AuthSocket>();
  private readonly latest = new Map<string, unknown>();
  private readonly permissions = new Map<string, TopicPermission[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly cpg: CustomPermissionGuardService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>
  ) {}

  private get logsConsumers() {
    return process.env.MANAGER_WS_LOG === "true";
  }

  registerTopic(topic: string, permissions: TopicPermission[]) {
    this.permissions.set(topic, permissions);
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
    const topic = data?.topic;
    if (!topic || !(await client.auth) || !client.userId) return;
    if (!(await this.mayConsume(client, topic))) {
      if (this.logsConsumers) this.log.warn(`x ${client.who} denied on "${topic}"`);
      return;
    }
    client.topics?.add(topic);
    if (this.logsConsumers) this.log.log(`+ ${client.who} consumes "${topic}" (${this.subscriberCount(topic)} consumer(s))`);
    if (this.latest.has(topic)) this.send(client, topic, this.latest.get(topic));
  }

  private async mayConsume(client: AuthSocket, topic: string) {
    const required = this.permissions.get(topic);
    if (!required) return false;
    if (client.isRoot) return true;
    try {
      for (const entry of required) {
        await this.cpg.guard.assertOne.global(client.userId!, entry.resource, { acrud: entry.actions });
      }
      return true;
    } catch {
      return false;
    }
  }

  @SubscribeMessage("unsubscribe")
  onUnsubscribe(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { topic?: string }) {
    const topic = data?.topic;
    if (!topic || !client.topics?.delete(topic)) return;
    if (this.logsConsumers)
      this.log.log(`- ${client.who} stopped consuming "${topic}" (${this.subscriberCount(topic)} consumer(s) left)`);
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
