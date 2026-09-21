import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { open, stat } from "fs/promises";
import { join } from "path";
import { In, IsNull, MoreThanOrEqual, Repository } from "typeorm";
import { DmarcEvaluation } from "../entities/dmarc-evaluation.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { domainOf } from "./dmarc-rua";

export const RECIPIENT_BACKLOG_BYTES = 32 * 1024 * 1024;
export const RECIPIENT_MEMORY_MS = 2 * 86_400_000;
export const RECIPIENT_SETTLE_MS = 120_000;
const READ_LIMIT = 8 * 1024 * 1024;
const CHUNK = 500;
const LINE = /postfix\/[\w/-]+\[\d+\]: ([0-9A-Za-z]{6,}): .*?\bto=<([^>]*)>(?:.*?\borig_to=<([^>]*)>)?/;

export function postfixLogPath() {
  return join(process.env.MAIL_LOG_PATH ?? "/var/log/mail", "postfix.log");
}

export function recipientOf(line: string): { jobId: string; address: string } | null {
  const match = LINE.exec(line);
  if (!match) return null;
  const address = (match[3] || match[2] || "").toLowerCase();
  return address.includes("@") ? { jobId: match[1]!, address } : null;
}

@Injectable()
export class DmarcRecipientsService {
  private readonly log = new Logger(DmarcRecipientsService.name);
  private readonly seen = new Map<string, { domains: Set<string>; at: number }>();
  private offset: number | null = null;
  private running = false;

  constructor(
    @InjectRepository(DmarcEvaluation)
    private readonly evaluations: Repository<DmarcEvaluation>,
    @InjectRepository(VirtualDomain)
    private readonly hosted: Repository<VirtualDomain>
  ) {}

  private async read(path: string): Promise<string[]> {
    const size = await stat(path)
      .then((s) => s.size)
      .catch(() => 0);
    if (this.offset === null || size < this.offset) this.offset = Math.max(0, size - RECIPIENT_BACKLOG_BYTES);
    const lines: string[] = [];
    const handle = size > this.offset ? await open(path, "r") : null;
    if (!handle) return lines;
    try {
      while (this.offset < size) {
        const length = Math.min(READ_LIMIT, size - this.offset);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, this.offset);
        const end = buffer.lastIndexOf(0x0a);
        if (end === -1) break;
        lines.push(...buffer.subarray(0, end).toString("utf8").split("\n"));
        this.offset += end + 1;
      }
    } finally {
      await handle.close();
    }
    return lines;
  }

  async resolve(now = Date.now()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const domains = new Set((await this.hosted.find({ select: { domain: true } })).map((row) => row.domain.toLowerCase()));
      for (const line of await this.read(postfixLogPath())) {
        const found = recipientOf(line);
        if (!found || !domains.has(domainOf(found.address))) continue;
        const entry = this.seen.get(found.jobId) ?? { domains: new Set<string>(), at: now };
        entry.domains.add(domainOf(found.address));
        entry.at = now;
        this.seen.set(found.jobId, entry);
      }
      const ready = [...this.seen].filter(([, entry]) => now - entry.at >= RECIPIENT_SETTLE_MS).map(([jobId]) => jobId);
      const matched: DmarcEvaluation[] = [];
      for (let i = 0; i < ready.length; i += CHUNK) {
        matched.push(
          ...(await this.evaluations.find({
            where: {
              jobId: In(ready.slice(i, i + CHUNK)),
              recipientDomain: IsNull(),
              receivedAt: MoreThanOrEqual(now - RECIPIENT_MEMORY_MS),
            },
          }))
        );
      }
      const clones: Partial<DmarcEvaluation>[] = [];
      for (const row of matched) {
        const [first, ...others] = [...this.seen.get(row.jobId)!.domains].sort();
        await this.evaluations.update({ id: row.id }, { recipientDomain: first! });
        for (const domain of others) {
          const { id: _id, createdAt: _createdAt, ...rest } = row;
          clones.push({ ...rest, recipientDomain: domain });
        }
      }
      for (let i = 0; i < clones.length; i += CHUNK) await this.evaluations.insert(clones.slice(i, i + CHUNK));
      for (const jobId of ready) this.seen.delete(jobId);
      return matched.length;
    } catch (e) {
      this.log.warn(`matching the DMARC evaluations to their recipients failed: ${(e as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
