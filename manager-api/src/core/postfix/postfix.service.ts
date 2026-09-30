import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { parseDeferLog, parseQueueFile, type DeferredRecipient, type QueueFileEnvelope } from "./postfix-queue-file";

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

export const QUEUE_NAMES = ["active", "deferred", "hold", "incoming"] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];
export const QUEUE_MESSAGES_LIMIT = 500;

export interface QueueMessageRecipient {
  address: string;
  status: string | null;
  reason: string | null;
}

export interface QueueMessage {
  id: string;
  arrivalTime: string;
  size: number;
  sender: string;
  recipients: QueueMessageRecipient[];
}

export interface PostfixQueueMessages {
  queue: QueueName;
  total: number;
  limit: number;
  messages: QueueMessage[];
  available: boolean;
}

interface Cached<T> {
  key: string;
  value: T;
}

const QUEUE_DIRS: (keyof QueueDirStats)[] = [...QUEUE_NAMES];

@Injectable()
export class PostfixService {
  private readonly log = new Logger(PostfixService.name);
  private readonly spoolPath: string;
  private readonly envelopes = new Map<string, Cached<QueueFileEnvelope>>();
  private readonly deferLogs = new Map<string, Cached<Map<string, DeferredRecipient>>>();

  constructor(cfg: ConfigService) {
    this.spoolPath = cfg.get<string>("POSTFIX_SPOOL_PATH") ?? "/var/spool/postfix";
  }

  async queueStats(domain?: string): Promise<PostfixQueueStats> {
    let available = true;
    const total: QueueDirStats = {
      active: 0,
      deferred: 0,
      hold: 0,
      incoming: 0,
    };
    const domainStats: QueueDirStats = {
      active: 0,
      deferred: 0,
      hold: 0,
      incoming: 0,
    };
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

  async queueMessages(queue: QueueName): Promise<PostfixQueueMessages> {
    const dirPath = join(this.spoolPath, queue);
    let files: Map<string, string>;
    try {
      files = await this.listFiles(dirPath);
    } catch (err) {
      this.log.warn(`Cannot read postfix queue dir ${dirPath}: ${(err as Error).message}`);
      return { queue, total: 0, limit: QUEUE_MESSAGES_LIMIT, messages: [], available: false };
    }

    const messages: QueueMessage[] = [];
    for (const [id, path] of files) {
      const read = await this.cachedRead(this.envelopes, path, (buf) => parseQueueFile(buf));
      if (!read) continue;
      const { value: envelope, mtimeMs, size } = read;
      messages.push({
        id,
        arrivalTime: new Date(envelope.arrival !== null ? envelope.arrival * 1000 : mtimeMs).toISOString(),
        size: envelope.size ?? size,
        sender: envelope.sender ?? "",
        recipients: envelope.recipients.map((address) => ({ address, status: null, reason: null })),
      });
    }
    this.prune(this.envelopes, dirPath, new Set(files.values()));

    messages.sort((a, b) => b.arrivalTime.localeCompare(a.arrivalTime) || a.id.localeCompare(b.id));
    const shown = messages.slice(0, QUEUE_MESSAGES_LIMIT);

    const deferDir = join(this.spoolPath, "defer");
    const deferFiles = await this.listFiles(deferDir).catch(() => new Map<string, string>());
    for (const message of shown) {
      const path = deferFiles.get(message.id);
      if (!path) continue;
      const read = await this.cachedRead(this.deferLogs, path, (buf) => parseDeferLog(buf.toString("utf8")));
      if (!read) continue;
      for (const recipient of message.recipients) {
        const deferred = read.value.get(recipient.address);
        if (deferred) Object.assign(recipient, deferred);
      }
    }
    this.prune(this.deferLogs, deferDir, new Set(deferFiles.values()));

    return { queue, total: messages.length, limit: QUEUE_MESSAGES_LIMIT, messages: shown, available: true };
  }

  private async listFiles(dirPath: string, found = new Map<string, string>()): Promise<Map<string, string>> {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dirPath, entry.name);
      if (entry.isDirectory()) await this.listFiles(path, found).catch(() => found);
      else if (entry.isFile()) found.set(entry.name, path);
    }
    return found;
  }

  private async cachedRead<T>(
    cache: Map<string, Cached<T>>,
    path: string,
    parse: (buf: Buffer) => T
  ): Promise<{ value: T; mtimeMs: number; size: number } | null> {
    try {
      const s = await stat(path);
      const key = `${s.mtimeMs}:${s.size}`;
      let cached = cache.get(path);
      if (!cached || cached.key !== key) {
        cached = { key, value: parse(await readFile(path)) };
        cache.set(path, cached);
      }
      return { value: cached.value, mtimeMs: s.mtimeMs, size: s.size };
    } catch {
      return null;
    }
  }

  private prune<T>(cache: Map<string, Cached<T>>, dirPath: string, live: Set<string>) {
    for (const path of cache.keys()) {
      if (path.startsWith(`${dirPath}/`) && !live.has(path)) cache.delete(path);
    }
  }
}
