import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { WebsocketGateway } from "./websocket.gateway";
import { buildWatchers, MIN_INTERVAL_MS } from "./watchers";

const DEFAULT_INTERVAL_MS = 3_000;

@Injectable()
export class WebsocketService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WebsocketService.name);
  private readonly timers: ReturnType<typeof setInterval>[] = [];

  constructor(
    private readonly gateway: WebsocketGateway,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  onModuleInit() {
    for (const watcher of buildWatchers(this.dataSource)) {
      this.gateway.registerTopic(watcher.topic, watcher.permissions);
      const intervalMs = Math.max(MIN_INTERVAL_MS, watcher.intervalMs ?? DEFAULT_INTERVAL_MS);
      let last: string | undefined;
      const poll = async () => {
        try {
          const value = await watcher.fn();
          const serialized = JSON.stringify(value ?? null);
          if (serialized === last) return;
          last = serialized;
          this.gateway.publish(watcher.topic, value);
        } catch (e) {
          this.log.warn(`"${watcher.topic}" watch failed: ${(e as Error).message}`);
        }
      };
      poll();
      this.timers.push(setInterval(poll, intervalMs));
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers) clearInterval(timer);
  }
}
