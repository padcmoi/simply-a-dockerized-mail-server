import { createConnection } from "net";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ClamavStats } from "./clamav.types";

const TIMEOUT_MS = 4000;

// clamd's own protocol, over the TCP socket its configuration already opens on
// the mail network. Every command is sent with the `n` prefix, which is what
// makes clamd answer newline terminated, and the connection is closed by clamd
// itself once it has answered. One connection per command: clamd expects that,
// and a pool would hold a thread of its own on the scanner for nothing.
@Injectable()
export class ClamdClient {
  private readonly log = new Logger(ClamdClient.name);
  private readonly host: string;
  private readonly port: number;

  constructor(cfg: ConfigService) {
    this.host = cfg.get<string>("CLAMAV_HOST") ?? "172.200.0.12";
    this.port = Number(cfg.get<string>("CLAMAV_PORT") ?? 3310);
  }

  async ping() {
    return (await this.ask("PING")) === "PONG";
  }

  /** "ClamAV 1.4.6/28129/Sun Sep 20 06:26:26 2026", or null while out of reach. */
  async version() {
    const answer = await this.ask("VERSION");
    return answer && answer.startsWith("ClamAV") ? answer : null;
  }

  async stats(): Promise<ClamavStats | null> {
    const answer = await this.ask("STATS");
    if (!answer) return null;

    const threads = /THREADS: live (\d+)\s+idle (\d+)\s+max (\d+)/.exec(answer);
    const queue = /QUEUE: (\d+) items/.exec(answer);
    const pools = /pools_used ([\d.]+)([KMG]?)/.exec(answer);

    return {
      threadsLive: threads ? Number(threads[1]) : null,
      threadsIdle: threads ? Number(threads[2]) : null,
      threadsMax: threads ? Number(threads[3]) : null,
      queue: queue ? Number(queue[1]) : null,
      poolsUsed: pools ? bytesOf(Number(pools[1]), pools[2] ?? "") : null,
    };
  }

  private ask(command: string) {
    return new Promise<string | null>((resolve) => {
      let answer = "";
      const socket = createConnection({ host: this.host, port: this.port });

      const done = (value: string | null) => {
        socket.destroy();
        resolve(value);
      };

      socket.setTimeout(TIMEOUT_MS, () => done(null));
      socket.on("connect", () => socket.write(`n${command}\n`));
      socket.on("data", (chunk) => (answer += chunk.toString()));
      socket.on("end", () => resolve(answer.trim()));
      socket.on("error", (e) => {
        // A scanner that is down is a page that says so, never a request that
        // fails: everything else on it is still worth reading.
        this.log.warn(`clamd ${command} failed: ${(e as Error).message}`);
        done(null);
      });
    });
  }
}

/** clamd writes its pools as "967.689M", which is mebibytes. */
function bytesOf(size: number, unit: string) {
  const scale: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
  return Math.round(size * (scale[unit] ?? 1));
}
