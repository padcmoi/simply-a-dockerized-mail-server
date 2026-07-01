import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

export interface QueueDirStats {
  active: number;
  deferred: number;
  hold: number;
  incoming: number;
}

export interface PostfixQueueStats {
  total: QueueDirStats;
  domain?: QueueDirStats;
  available: boolean;
}

const QUEUE_DIRS: (keyof QueueDirStats)[] = ["active", "deferred", "hold", "incoming"];

@Injectable()
export class PostfixService {
  private readonly log = new Logger(PostfixService.name);
  private readonly spoolPath: string;

  constructor(cfg: ConfigService) {
    this.spoolPath = cfg.get<string>("POSTFIX_SPOOL_PATH") ?? "/var/spool/postfix";
  }

  async queueStats(domain?: string): Promise<PostfixQueueStats> {
    let available = true;
    const total: QueueDirStats = { active: 0, deferred: 0, hold: 0, incoming: 0 };
    const domainStats: QueueDirStats = { active: 0, deferred: 0, hold: 0, incoming: 0 };
    const domainBuf = domain ? Buffer.from(`@${domain}`) : undefined;

    for (const dir of QUEUE_DIRS) {
      const dirPath = join(this.spoolPath, dir);
      try {
        const { count, domainCount } = await this.scanDir(dirPath, domainBuf);
        total[dir] = count;
        domainStats[dir] = domainCount;
      } catch (err) {
        if (available) {
          this.log.warn(`Cannot read postfix queue dir ${dirPath}: ${(err as Error).message}`);
          available = false;
        }
      }
    }

    return { total, domain: domain ? domainStats : undefined, available };
  }

  private async scanDir(dirPath: string, domainBuf?: Buffer): Promise<{ count: number; domainCount: number }> {
    let count = 0;
    let domainCount = 0;

    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      return { count, domainCount };
    }

    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      let s;
      try {
        s = await stat(entryPath);
      } catch {
        continue;
      }

      if (s.isDirectory()) {
        const sub = await this.scanDir(entryPath, domainBuf);
        count += sub.count;
        domainCount += sub.domainCount;
      } else if (s.isFile()) {
        count++;
        if (domainBuf) {
          try {
            const content = await readFile(entryPath);
            if (content.includes(domainBuf)) domainCount++;
          } catch {
            // unreadable file, skip
          }
        }
      }
    }

    return { count, domainCount };
  }
}
