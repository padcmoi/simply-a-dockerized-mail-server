import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import * as net from "net";
import * as os from "os";
import type { DataSource } from "typeorm";

type Probe = "ok" | "down";
type Tier = "low" | "medium" | "high";

export interface HealthSnapshot {
  status: "ok" | "degraded" | "down";
  cpu: Tier;
  memory: Tier;
  redis: Probe;
  db: Probe;
  cpuPercent: number;
  memoryPercent: number;
  loadScore: number;
  charge: Tier | "down";
  loadSignal: string;
}

const REDIS_HOST = process.env.REDIS_HOST ?? "mail-redis";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const POSTFIX_HOST = process.env.POSTFIX_HOST ?? "mail-postfix";
const POSTFIX_PORT = Number(process.env.POSTFIX_PORT ?? 25);
const PROBE_TIMEOUT_MS = 1500;

@Injectable()
export class HealthcheckService {
  private readonly log = new Logger(HealthcheckService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async snapshot(): Promise<HealthSnapshot> {
    const [cpu, memory, redis, db, mail] = await Promise.all([
      this.cpu(),
      this.memory(),
      this.pingRedis(),
      this.pingDb(),
      this.pingPostfix(),
    ]);

    const loadScore = this.loadScore();
    const charge: Tier | "down" = mail === "ok" ? this.classify(loadScore) : "down";
    const cpuTier = this.classify(cpu);
    const memoryTier = this.classify(memory);

    let status: HealthSnapshot["status"] = "ok";
    if (db === "down") status = "down";
    else if (redis === "down" || mail === "down") status = "degraded";
    else if (cpuTier === "high" || memoryTier === "high" || charge === "high") status = "degraded";

    return {
      status,
      cpu: cpuTier,
      memory: memoryTier,
      redis,
      db,
      cpuPercent: Math.round(cpu),
      memoryPercent: Math.round(memory),
      loadScore: Math.round(loadScore),
      charge,
      loadSignal: this.loadSignal(loadScore),
    };
  }

  // Sample the manager-api process CPU usage over a short window, then
  // express it as a percentage of one full CPU core (capped at 100). It is
  // the most honest cross-platform signal for a Node process inside a
  // container; container-wide CPU would require reading cgroups v2.
  private async cpu(): Promise<number> {
    const start = process.cpuUsage();
    const windowMs = 100;
    await new Promise<void>((resolve) => setTimeout(resolve, windowMs));
    const elapsed = process.cpuUsage(start);
    const totalMicros = elapsed.user + elapsed.system;
    const windowMicros = windowMs * 1000;
    const cores = Math.max(1, os.cpus().length);
    return Math.min(100, (totalMicros / windowMicros / cores) * 100);
  }

  private async memory(): Promise<number> {
    const total = os.totalmem();
    const free = os.freemem();
    if (!total) return 0;
    return ((total - free) / total) * 100;
  }

  // 1-minute load average normalised against the visible CPU count, gives a
  // host-wide pressure signal. Inside a container with no cpu quota this
  // still reflects the host load, which is intentional: a noisy neighbour
  // also degrades the API responsiveness.
  private loadScore(): number {
    const cores = Math.max(1, os.cpus().length);
    const oneMin = os.loadavg()[0] ?? 0;
    return Math.min(100, (oneMin / cores) * 100);
  }

  private classify(pct: number): Tier {
    if (pct < 50) return "low";
    if (pct < 80) return "medium";
    return "high";
  }

  private loadSignal(score: number): string {
    return `up ${Math.max(0, 100 - Math.round(score))}%`;
  }

  private async pingDb(): Promise<Probe> {
    try {
      await this.ds.query("SELECT 1");
      return "ok";
    } catch (e) {
      this.log.warn(`db probe failed: ${(e as Error).message}`);
      return "down";
    }
  }

  // Raw RESP PING -- avoids pulling a redis client just for the probe. Any
  // reply starting with "+PONG" means the server speaks RESP and is alive.
  private pingRedis(): Promise<Probe> {
    return this.rawProbe(REDIS_HOST, REDIS_PORT, "*1\r\n$4\r\nPING\r\n", (chunk) => chunk.toString("utf8").startsWith("+PONG"));
  }

  // Postfix sends a "220 ... ESMTP ..." banner on connect. No queue depth
  // here -- that would require sharing the postfix spool read-only into the
  // manager-api container. For now the probe just confirms the SMTP socket
  // is accepting, and `charge` flips to "down" when it is not.
  private pingPostfix(): Promise<Probe> {
    return this.rawProbe(POSTFIX_HOST, POSTFIX_PORT, null, (chunk) => chunk.toString("utf8").startsWith("220 "));
  }

  private rawProbe(host: string, port: number, send: string | null, accept: (chunk: Buffer) => boolean): Promise<Probe> {
    return new Promise<Probe>((resolve) => {
      let settled = false;
      const sock = net.createConnection({ host, port });
      const settle = (verdict: Probe) => {
        if (settled) return;
        settled = true;
        sock.destroy();
        resolve(verdict);
      };
      const timer = setTimeout(() => settle("down"), PROBE_TIMEOUT_MS);
      sock.once("connect", () => {
        if (send) sock.write(send);
      });
      sock.once("data", (chunk: Buffer) => {
        clearTimeout(timer);
        settle(accept(chunk) ? "ok" : "down");
      });
      sock.once("error", () => {
        clearTimeout(timer);
        settle("down");
      });
    });
  }
}
