import { Injectable, Logger } from "@nestjs/common";
import type { Socket } from "net";
import { connect } from "tls";
import { DMARC_REPORTS_LOCAL_PART } from "../common/reserved-mailboxes";
import { dmarcReportsPassword } from "./dmarc-mailbox";

const TIMEOUT_MS = 30_000;

export interface DmarcImapTarget {
  folder: string;
  key: string;
}

interface Waiter {
  tag: string | null;
  lines: string[];
  resolve: (lines: string[]) => void;
  reject: (error: Error) => void;
}

export function imapQuote(value: string) {
  if (/[\r\n\0]/.test(value)) throw new Error("an IMAP string cannot hold a line break");
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

export function xGuid(line: string) {
  const match = /\bX-GUID (?:"((?:[^"\\]|\\.)*)"|([^\s()]+))/.exec(line);
  if (!match) return null;
  return match[1] === undefined ? (match[2] ?? null) : match[1].replace(/\\(.)/g, "$1");
}

export class ImapSession {
  private buffer = Buffer.alloc(0);
  private unit = "";
  private literal: number | null = null;
  private readonly units: string[] = [];
  private pending: Waiter | null = null;
  private failure: Error | null = null;
  private seq = 0;

  constructor(
    private readonly socket: Socket,
    timeoutMs = TIMEOUT_MS
  ) {
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error("IMAP timed out")));
    socket.on("data", (chunk: Buffer) => this.receive(chunk));
    socket.on("error", (error: Error) => this.fail(error));
    socket.on("close", () => this.fail(new Error("IMAP connection closed")));
  }

  greeting() {
    return this.wait(null);
  }

  command(text: string) {
    this.seq += 1;
    const tag = `a${this.seq}`;
    return this.wait(tag, () => this.socket.write(`${tag} ${text}\r\n`));
  }

  async close() {
    if (!this.failure) await this.command("LOGOUT").catch(() => []);
    this.socket.destroy();
  }

  private wait(tag: string | null, send?: () => void) {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise<string[]>((resolve, reject) => {
      this.pending = { tag, lines: [], resolve, reject };
      send?.();
      this.drain();
    });
  }

  private receive(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.literal !== null) {
        if (this.buffer.length < this.literal) return;
        const content = this.buffer.subarray(0, this.literal).toString("utf8");
        this.unit += `"${content.replace(/[\\"]/g, "\\$&").replace(/[\r\n]+/g, " ")}"`;
        this.buffer = this.buffer.subarray(this.literal);
        this.literal = null;
        continue;
      }
      const end = this.buffer.indexOf("\r\n");
      if (end < 0) return;
      const line = this.buffer.subarray(0, end).toString("utf8");
      this.buffer = this.buffer.subarray(end + 2);
      const literal = /\{(\d+)\+?\}$/.exec(line);
      if (literal) {
        this.unit += line.slice(0, literal.index);
        this.literal = Number(literal[1]);
        continue;
      }
      this.units.push(this.unit + line);
      this.unit = "";
      this.drain();
    }
  }

  private drain() {
    while (this.pending) {
      const unit = this.units.shift();
      if (unit === undefined) return;
      const waiter = this.pending;
      if (waiter.tag === null) {
        this.pending = null;
        if (unit.startsWith("* OK")) waiter.resolve([]);
        else waiter.reject(new Error(`IMAP greeting refused: ${unit}`));
      } else if (unit.startsWith(`${waiter.tag} `)) {
        this.pending = null;
        const status = unit.slice(waiter.tag.length + 1);
        if (status.startsWith("OK")) waiter.resolve(waiter.lines);
        else waiter.reject(new Error(`IMAP ${status}`));
      } else {
        waiter.lines.push(unit);
      }
    }
  }

  private fail(error: Error) {
    this.failure ??= error;
    const waiter = this.pending;
    this.pending = null;
    waiter?.reject(error);
  }
}

@Injectable()
export class DmarcImapService {
  private readonly log = new Logger(DmarcImapService.name);

  protected open(): ImapSession {
    return new ImapSession(
      connect({
        host: process.env.DMARC_IMAP_HOST ?? "mail-dovecot",
        port: Number(process.env.DMARC_IMAP_PORT ?? 993),
        servername: process.env.MAIL_HOSTNAME || undefined,
        rejectUnauthorized: false,
      })
    );
  }

  async expunge(address: string, targets: DmarcImapTarget[]): Promise<number> {
    const mailbox = address.toLowerCase();
    const password = dmarcReportsPassword(mailbox);
    if (!mailbox.startsWith(`${DMARC_REPORTS_LOCAL_PART}@`) || password === null || !targets.length) return 0;

    const folders = new Map<string, Set<string>>();
    for (const target of targets) folders.set(target.folder, (folders.get(target.folder) ?? new Set()).add(target.key));

    const session = this.open();
    let deleted = 0;
    try {
      await session.greeting();
      await session.command(`LOGIN ${imapQuote(mailbox)} ${imapQuote(password)}`);
      for (const [folder, keys] of folders) {
        try {
          await session.command(`SELECT ${imapQuote(folder)}`);
          const uids = (await session.command("UID FETCH 1:* (X-GUID)")).flatMap((line) => {
            const uid = /\bUID (\d+)/.exec(line)?.[1];
            const guid = xGuid(line);
            return uid !== undefined && guid !== null && keys.has(guid) ? [uid] : [];
          });
          if (!uids.length) continue;
          await session.command(`UID STORE ${uids.join(",")} +FLAGS.SILENT (\\Deleted)`);
          await session.command(`UID EXPUNGE ${uids.join(",")}`);
          deleted += uids.length;
        } catch (e) {
          this.log.warn(`deleting the mails read in ${mailbox}, folder ${folder}, failed: ${(e as Error).message}`);
        }
      }
    } finally {
      await session.close();
    }
    return deleted;
  }
}
