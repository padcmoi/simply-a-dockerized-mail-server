import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { DataSource, In, LessThan, Like, Repository } from "typeorm";
import { DmarcInboxMessage } from "../entities/dmarc-inbox-message.entity";
import { DmarcIncomingRecord } from "../entities/dmarc-incoming-record.entity";
import { DmarcIncomingReport } from "../entities/dmarc-incoming-report.entity";
import { VirtualUser } from "../entities/virtual-user.entity";
import { DMARC_REPORTS_LOCAL_PART } from "../common/reserved-mailboxes";
import { readDmarcMessage } from "./dmarc-attachments";
import { parseFeedback } from "./dmarc-feedback.parser";
import { DmarcSettingsService } from "./dmarc-settings.service";
import type { DmarcFeedback, DmarcInboxStatus } from "./dmarc.types";

const MAX_PER_SCAN = 100;
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

export interface DmarcScanSummary {
  mailboxes: number;
  scanned: number;
  imported: number;
  duplicates: number;
  ignored: number;
  failed: number;
}

export function messageKey(filename: string) {
  return filename.split(":2,")[0] ?? filename;
}

function clip(value: string | null, length: number) {
  return value === null ? null : value.slice(0, length);
}

export function totals(feedback: DmarcFeedback) {
  let messages = 0;
  let dmarcPass = 0;
  let dkimPass = 0;
  let spfPass = 0;
  for (const record of feedback.records) {
    messages += record.count;
    if (record.dkim === "pass") dkimPass += record.count;
    if (record.spf === "pass") spfPass += record.count;
    if (record.dkim === "pass" || record.spf === "pass") dmarcPass += record.count;
  }
  return { messages, dmarcPass, dkimPass, spfPass };
}

@Injectable()
export class DmarcInboxService {
  private readonly log = new Logger(DmarcInboxService.name);
  private running = false;
  lastRunAt: number | null = null;
  lastSummary: DmarcScanSummary | null = null;

  constructor(
    @InjectRepository(DmarcInboxMessage)
    private readonly messages: Repository<DmarcInboxMessage>,
    @InjectRepository(DmarcIncomingReport)
    private readonly reports: Repository<DmarcIncomingReport>,
    @InjectRepository(VirtualUser)
    private readonly users: Repository<VirtualUser>,
    private readonly settings: DmarcSettingsService,
    private readonly dataSource: DataSource
  ) {}

  private mailRoot() {
    return process.env.MAIL_VOLUME_PATH ?? "/var/mail";
  }

  private async files(mailbox: string): Promise<string[]> {
    const user = await this.users.findOne({ where: { email: mailbox } });
    if (!user) return [];
    const base = join(this.mailRoot(), "vhosts", user.maildir);
    const entries = await readdir(base, { withFileTypes: true }).catch(() => []);
    const folders = [
      base,
      ...entries.filter((entry) => entry.isDirectory() && entry.name.startsWith(".")).map((entry) => join(base, entry.name)),
    ];
    const found: string[] = [];
    for (const folder of folders) {
      for (const part of ["new", "cur"]) {
        const names = await readdir(join(folder, part)).catch(() => [] as string[]);
        found.push(...names.map((name) => join(folder, part, name)));
      }
    }
    return found;
  }

  async store(feedback: DmarcFeedback, xml: string, mailbox: string): Promise<boolean> {
    const existing = await this.reports.findOne({
      where: { orgName: feedback.orgName.slice(0, 255), reportId: feedback.reportId.slice(0, 255) },
    });
    if (existing) return false;

    const sums = totals(feedback);
    await this.dataSource.transaction(async (manager) => {
      const report = await manager.save(
        manager.create(DmarcIncomingReport, {
          orgName: feedback.orgName.slice(0, 255),
          orgEmail: feedback.email.slice(0, 320),
          extraContact: clip(feedback.extraContact, 512),
          reportId: feedback.reportId.slice(0, 255),
          domain: feedback.policy.domain.slice(0, 255),
          periodBegin: feedback.begin,
          periodEnd: feedback.end,
          adkim: feedback.policy.adkim,
          aspf: feedback.policy.aspf,
          p: feedback.policy.p,
          sp: feedback.policy.sp,
          pct: feedback.policy.pct,
          records: feedback.records.length,
          ...sums,
          mailbox,
          xml,
        })
      );
      if (feedback.records.length) {
        await manager.insert(
          DmarcIncomingRecord,
          feedback.records.map((record) => ({
            reportId: report.id,
            sourceIp: record.sourceIp.slice(0, 45),
            count: record.count,
            disposition: record.disposition,
            dkim: record.dkim,
            spf: record.spf,
            headerFrom: record.headerFrom.slice(0, 255),
            envelopeFrom: clip(record.envelopeFrom, 255),
            envelopeTo: clip(record.envelopeTo, 255),
            dkimResults: record.dkimResults,
            spfResults: record.spfResults,
            reasons: record.reasons,
          }))
        );
      }
    });
    return true;
  }

  private async read(file: string, mailbox: string): Promise<Partial<DmarcInboxMessage>> {
    const size = (await stat(file)).size;
    if (size > MAX_MESSAGE_BYTES) return { status: "not-a-report", detail: "too-large" };

    const message = await readDmarcMessage(new Uint8Array(await readFile(file)));
    const base = {
      messageId: clip(message.messageId, 512),
      sender: clip(message.from, 320),
      subject: clip(message.subject, 512),
    };
    if (!message.documents.length) return { ...base, status: "not-a-report" };

    let imported = 0;
    let duplicates = 0;
    const errors: string[] = [];
    for (const xml of message.documents) {
      try {
        if (await this.store(parseFeedback(xml), xml, mailbox)) imported += 1;
        else duplicates += 1;
      } catch (e) {
        errors.push((e as Error).message);
      }
    }

    const status: DmarcInboxStatus = imported ? "imported" : duplicates ? "duplicate" : "failed";
    return { ...base, status, reports: imported, detail: errors.length ? errors.join("; ").slice(0, 1024) : null };
  }

  async mailboxes(): Promise<string[]> {
    const { inboxes } = await this.settings.get();
    const reserved = (
      await this.users.find({ where: { email: Like(`${DMARC_REPORTS_LOCAL_PART}%@%`) }, select: { email: true } })
    )
      .map((user) => user.email.toLowerCase())
      .filter((email) => email.startsWith(`${DMARC_REPORTS_LOCAL_PART}@`));
    return [...new Set([...reserved.sort(), ...inboxes.map((email) => email.toLowerCase())])];
  }

  async prune(now: number): Promise<void> {
    try {
      const { retentionDays } = await this.settings.get();
      await this.reports.delete({ receivedAt: LessThan(new Date(now - retentionDays * 86_400_000)) });
    } catch (e) {
      this.log.warn(`pruning the received DMARC reports failed: ${(e as Error).message}`);
    }
  }

  async scan(): Promise<DmarcScanSummary> {
    const summary: DmarcScanSummary = { mailboxes: 0, scanned: 0, imported: 0, duplicates: 0, ignored: 0, failed: 0 };
    if (this.running) return summary;
    this.running = true;
    try {
      for (const mailbox of await this.mailboxes()) {
        summary.mailboxes += 1;
        const files = await this.files(mailbox);
        const keys = files.map((file) => messageKey(file.slice(file.lastIndexOf("/") + 1)));
        const known = new Set(
          keys.length
            ? (await this.messages.find({ where: { mailbox, messageKey: In(keys) }, select: { messageKey: true } })).map(
                (row) => row.messageKey
              )
            : []
        );

        for (const [index, file] of files.entries()) {
          if (summary.scanned >= MAX_PER_SCAN) break;
          const key = keys[index] as string;
          if (known.has(key)) continue;
          known.add(key);
          summary.scanned += 1;

          let outcome: Partial<DmarcInboxMessage>;
          try {
            outcome = await this.read(file, mailbox);
          } catch (e) {
            outcome = { status: "failed", detail: (e as Error).message.slice(0, 1024) };
          }
          await this.messages.insert({ mailbox, messageKey: key.slice(0, 255), reports: 0, ...outcome });

          if (outcome.status === "imported") summary.imported += outcome.reports ?? 0;
          else if (outcome.status === "duplicate") summary.duplicates += 1;
          else if (outcome.status === "not-a-report") summary.ignored += 1;
          else summary.failed += 1;
        }
      }
      this.lastRunAt = Date.now();
      this.lastSummary = summary;
      return summary;
    } catch (e) {
      this.log.warn(`reading the DMARC report inboxes failed: ${(e as Error).message}`);
      return summary;
    } finally {
      this.running = false;
    }
  }
}
