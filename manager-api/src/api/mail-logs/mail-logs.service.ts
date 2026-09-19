import { createReadStream } from "fs";
import { open, stat } from "fs/promises";
import { join } from "path";
import { Injectable } from "@nestjs/common";
import type { MailLogQuery, MailLogService } from "./mail-logs.validation";

const CHUNK = 64 * 1024;
const SCAN_LIMIT = 32 * 1024 * 1024;
const FOLLOW_LIMIT = 1024 * 1024;

export interface MailLogWindow {
  service: MailLogService;
  lines: string[];
  size: number;
  start: number;
  updatedAt: string | null;
  truncated: boolean;
}

export interface MailLogFrame {
  service: MailLogService;
  from: number;
  to: number;
  lines: string[];
}

@Injectable()
export class MailLogsService {
  private readonly directory = process.env.MAIL_LOG_PATH ?? "/var/log/mail";
  private readonly offsets = new Map<MailLogService, number>();

  async file(service: MailLogService) {
    const path = join(this.directory, `${service}.log`);
    const info = await stat(path).catch(() => null);
    if (!info) return null;
    return { stream: createReadStream(path), size: info.size };
  }

  async follow(service: MailLogService): Promise<MailLogFrame> {
    const path = join(this.directory, `${service}.log`);
    const info = await stat(path).catch(() => null);
    const size = info?.size ?? 0;
    const offset = this.offsets.get(service);

    if (offset === undefined || size <= offset) {
      this.offsets.set(service, size);
      return { service, from: size, to: size, lines: [] };
    }

    const start = Math.max(offset, size - FOLLOW_LIMIT);
    const length = size - start;
    const buffer = Buffer.alloc(length);
    const handle = await open(path, "r");
    try {
      await handle.read(buffer, 0, length, start);
    } finally {
      await handle.close();
    }

    const end = buffer.lastIndexOf(0x0a);
    if (end === -1) return { service, from: offset, to: offset, lines: [] };

    const lines = buffer.subarray(0, end).toString("utf8").split("\n");
    if (start > offset) lines.shift();

    const to = start + end + 1;
    this.offsets.set(service, to);
    return { service, from: offset, to, lines: lines.filter((line) => line.length > 0) };
  }

  async tail(service: MailLogService, { lines: wanted, q, before }: MailLogQuery): Promise<MailLogWindow> {
    const path = join(this.directory, `${service}.log`);
    const info = await stat(path).catch(() => null);
    if (!info) return { service, lines: [], size: 0, start: 0, updatedAt: null, truncated: false };

    const needle = q ? q.toLowerCase() : null;
    const keep = (line: Buffer) => {
      if (line.length === 0) return null;
      const text = line.toString("utf8");
      return !needle || text.toLowerCase().includes(needle) ? text : null;
    };

    const handle = await open(path, "r");
    const found: string[] = [];
    let position = Math.min(before ?? info.size, info.size);
    let carry = Buffer.alloc(0);
    let start = position;
    let scanned = 0;

    try {
      while (position > 0 && found.length < wanted && scanned < SCAN_LIMIT) {
        const length = Math.min(CHUNK, position);
        position -= length;
        scanned += length;

        const chunk = Buffer.alloc(length);
        await handle.read(chunk, 0, length, position);
        const combined = Buffer.concat([chunk, carry]);

        let end = combined.length;
        let newline = combined.lastIndexOf(0x0a, end - 1);
        while (newline !== -1 && found.length < wanted) {
          const text = keep(combined.subarray(newline + 1, end));
          start = position + newline + 1;
          if (text !== null) found.push(text);
          end = newline;
          newline = end > 0 ? combined.lastIndexOf(0x0a, end - 1) : -1;
        }
        carry = combined.subarray(0, end);
        if (found.length < wanted && newline === -1) start = position + end;
      }

      if (position === 0 && found.length < wanted && carry.length) {
        const text = keep(carry);
        if (text !== null) found.push(text);
        start = 0;
      }
    } finally {
      await handle.close();
    }

    return {
      service,
      lines: found.reverse(),
      size: info.size,
      start,
      updatedAt: info.mtime.toISOString(),
      truncated: start > 0 && found.length < wanted,
    };
  }
}
