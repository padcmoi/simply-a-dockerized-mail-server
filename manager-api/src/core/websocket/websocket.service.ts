import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { DomainsService } from "../../api/domains/domains.service";
import { TicketsService } from "../../api/tickets/tickets.service";
import { JwtAuthService } from "../auth/jwt/jwt.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PostfixService } from "../postfix/postfix.service";
import { AccountPresenceService } from "./account-presence.service";
import { WebsocketGateway } from "./websocket.gateway";
import { buildWatchers, MIN_INTERVAL_MS } from "./watchers";
import { Watcher } from "./watcher.type";

const DEFAULT_INTERVAL_MS = 3_000;

@Injectable()
export class WebsocketService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WebsocketService.name);
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  // Parameterized watchers wait here until a subscriber asks for a concrete
  // instance (base -> watcher), then a poller keyed by the full "base:param"
  // topic runs only while that instance has at least one subscriber.
  private readonly parameterized = new Map<string, Watcher>();

  constructor(
    private readonly gateway: WebsocketGateway,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly domains: DomainsService,
    private readonly postfix: PostfixService,
    private readonly sessions: JwtAuthService,
    private readonly notifications: NotificationsService,
    private readonly tickets: TicketsService,
    private readonly presence: AccountPresenceService
  ) {}

  onModuleInit() {
    this.gateway.setDynamicHandlers({
      start: (fullTopic, base, param) => {
        const watcher = this.parameterized.get(base);
        if (watcher) this.startPoller(fullTopic, watcher, param);
      },
      stop: (fullTopic) => this.stopPoller(fullTopic),
    });

    const deps = {
      dataSource: this.dataSource,
      domains: this.domains,
      postfix: this.postfix,
      sessions: this.sessions,
      notifications: this.notifications,
      tickets: this.tickets,
      presence: this.presence,
    };
    for (const watcher of buildWatchers(deps)) {
      this.gateway.registerTopic(watcher.topic, {
        permissions: watcher.permissions,
        scope: watcher.scope ?? "global",
        parameterized: watcher.parameterized ?? false,
        authorize: watcher.authorize,
      });
      if (watcher.parameterized) this.parameterized.set(watcher.topic, watcher);
      else this.startPoller(watcher.topic, watcher);
    }
  }

  private startPoller(fullTopic: string, watcher: Watcher, param?: string) {
    if (this.timers.has(fullTopic)) return;
    const intervalMs = Math.max(MIN_INTERVAL_MS, watcher.intervalMs ?? DEFAULT_INTERVAL_MS);
    let last: string | undefined;
    const poll = async () => {
      try {
        const value = await watcher.fn(param);
        const serialized = JSON.stringify(value ?? null);
        if (serialized === last) return;
        last = serialized;
        this.gateway.publish(fullTopic, value);
      } catch (e) {
        this.log.warn(`"${fullTopic}" watch failed: ${(e as Error).message}`);
      }
    };
    poll();
    this.timers.set(fullTopic, setInterval(poll, intervalMs));
  }

  private stopPoller(fullTopic: string) {
    const timer = this.timers.get(fullTopic);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(fullTopic);
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }
}
