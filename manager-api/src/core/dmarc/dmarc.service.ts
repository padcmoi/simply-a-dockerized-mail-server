import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Like, MoreThanOrEqual, Repository } from "typeorm";
import { PaginatedResult, resolveSearchColumn, resolveSortColumn } from "../common/pagination.validation";
import { reservedLocalPartOf } from "../common/reserved-mailboxes";
import { DmarcEvaluation } from "../entities/dmarc-evaluation.entity";
import { DmarcInboxMessage } from "../entities/dmarc-inbox-message.entity";
import { DmarcIncomingRecord } from "../entities/dmarc-incoming-record.entity";
import { DmarcIncomingReport } from "../entities/dmarc-incoming-report.entity";
import { DmarcOutgoingReport } from "../entities/dmarc-outgoing-report.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { VirtualUser } from "../entities/virtual-user.entity";
import { DmarcInboxService } from "./dmarc-inbox.service";
import { DmarcIngestService } from "./dmarc-ingest.service";
import { DmarcRecipientsService } from "./dmarc-recipients.service";
import { DmarcReporterService, dayWindow, previousDay } from "./dmarc-reporter.service";
import { DmarcSettingsService } from "./dmarc-settings.service";
import {
  DMARC_INBOX_SEARCHABLE,
  DMARC_INBOX_SORTABLE,
  DMARC_INCOMING_SEARCHABLE,
  DMARC_INCOMING_SORTABLE,
  DMARC_OUTGOING_SEARCHABLE,
  DMARC_OUTGOING_SORTABLE,
  type DmarcInboxQuery,
  type DmarcIncomingQuery,
  type DmarcOutgoingQuery,
  type DmarcSettingsDto,
} from "./dmarc.validation";

const WINDOW_MS = 30 * 86_400_000;

const INCOMING_COLUMNS: (keyof DmarcIncomingReport)[] = [
  "id",
  "orgName",
  "orgEmail",
  "extraContact",
  "reportId",
  "domain",
  "periodBegin",
  "periodEnd",
  "adkim",
  "aspf",
  "p",
  "sp",
  "pct",
  "records",
  "messages",
  "dmarcPass",
  "dkimPass",
  "spfPass",
  "mailbox",
  "receivedAt",
];

const OUTGOING_COLUMNS: (keyof DmarcOutgoingReport)[] = [
  "id",
  "reportId",
  "reporterDomain",
  "policyDomain",
  "recipient",
  "periodBegin",
  "periodEnd",
  "records",
  "messages",
  "sizeBytes",
  "status",
  "reason",
  "attempts",
  "createdAt",
  "sentAt",
];

function searchWhere<T>(base: FindOptionsWhere<T>, term: string | undefined, fields: readonly string[], by: string | null) {
  if (!term) return base;
  return fields.filter((field) => !by || field === by).map((field) => ({ ...base, [field]: Like(`%${term}%`) }));
}

function counts(rows: { status: string; total: string | number }[]) {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)])) as Record<string, number>;
}

@Injectable()
export class DmarcService {
  constructor(
    @InjectRepository(DmarcEvaluation)
    private readonly evaluations: Repository<DmarcEvaluation>,
    @InjectRepository(DmarcIncomingReport)
    private readonly incoming: Repository<DmarcIncomingReport>,
    @InjectRepository(DmarcIncomingRecord)
    private readonly records: Repository<DmarcIncomingRecord>,
    @InjectRepository(DmarcOutgoingReport)
    private readonly outgoing: Repository<DmarcOutgoingReport>,
    @InjectRepository(DmarcInboxMessage)
    private readonly inboxMessages: Repository<DmarcInboxMessage>,
    @InjectRepository(VirtualUser)
    private readonly users: Repository<VirtualUser>,
    @InjectRepository(VirtualDomain)
    private readonly hosted: Repository<VirtualDomain>,
    private readonly settings: DmarcSettingsService,
    private readonly ingest: DmarcIngestService,
    private readonly recipients: DmarcRecipientsService,
    private readonly inbox: DmarcInboxService,
    private readonly reporter: DmarcReporterService
  ) {}

  async overview(now = Date.now()) {
    const since = new Date(now - WINDOW_MS);
    const [settings, inboxes, hosted, evaluations24h, domains, outgoing, inbox] = await Promise.all([
      this.settings.get(),
      this.inbox.mailboxes(),
      this.hosted.find({ select: { domain: true }, order: { domain: "ASC" } }),
      this.evaluations.count({ where: { receivedAt: MoreThanOrEqual(now - 86_400_000) } }),
      this.incoming
        .createQueryBuilder("r")
        .select("r.domain", "domain")
        .addSelect("COUNT(*)", "reports")
        .addSelect("COUNT(DISTINCT r.org_name)", "reporters")
        .addSelect("SUM(r.messages)", "messages")
        .addSelect("SUM(r.dmarc_pass)", "dmarcPass")
        .addSelect("SUM(r.dkim_pass)", "dkimPass")
        .addSelect("SUM(r.spf_pass)", "spfPass")
        .addSelect("MAX(r.period_end)", "lastPeriodEnd")
        .where("r.received_at >= :since", { since })
        .groupBy("r.domain")
        .orderBy("messages", "DESC")
        .getRawMany<Record<string, string | number | null>>(),
      this.outgoing
        .createQueryBuilder("o")
        .select("o.status", "status")
        .addSelect("COUNT(*)", "total")
        .where("o.created_at >= :since", { since })
        .groupBy("o.status")
        .getRawMany<{ status: string; total: string }>(),
      this.inboxMessages
        .createQueryBuilder("m")
        .select("m.status", "status")
        .addSelect("COUNT(*)", "total")
        .where("m.scanned_at >= :since", { since })
        .groupBy("m.status")
        .getRawMany<{ status: string; total: string }>(),
    ]);

    const sent = counts(outgoing);
    const scanned = counts(inbox);
    return {
      settings: { sendingEnabled: settings.sendingEnabled, reportHour: settings.reportHour, inboxes },
      hostedDomains: hosted.map((row) => row.domain.toLowerCase()),
      ingest: { lastRunAt: this.ingest.lastRunAt, lastCount: this.ingest.lastCount, evaluations24h },
      outgoing: {
        lastRunAt: this.reporter.lastRunAt,
        lastSummary: this.reporter.lastSummary,
        sent: sent.sent ?? 0,
        failed: sent.failed ?? 0,
        skipped: sent.skipped ?? 0,
      },
      inbox: {
        lastRunAt: this.inbox.lastRunAt,
        imported: scanned.imported ?? 0,
        duplicate: scanned.duplicate ?? 0,
        ignored: scanned["not-a-report"] ?? 0,
        failed: scanned.failed ?? 0,
      },
      domains: domains.map((row) => ({
        domain: String(row.domain),
        reports: Number(row.reports),
        reporters: Number(row.reporters),
        messages: Number(row.messages ?? 0),
        dmarcPass: Number(row.dmarcPass ?? 0),
        dkimPass: Number(row.dkimPass ?? 0),
        spfPass: Number(row.spfPass ?? 0),
        lastPeriodEnd: row.lastPeriodEnd === null ? null : Number(row.lastPeriodEnd),
      })),
    };
  }

  async listIncoming(query: DmarcIncomingQuery): Promise<PaginatedResult<DmarcIncomingReport>> {
    const sortBy = resolveSortColumn(query.sortBy, DMARC_INCOMING_SORTABLE, "periodBegin");
    const base: FindOptionsWhere<DmarcIncomingReport> = query.domain ? { domain: query.domain } : {};
    const searchable = query.domain ? DMARC_INCOMING_SEARCHABLE.filter((field) => field !== "domain") : DMARC_INCOMING_SEARCHABLE;
    const where = searchWhere(base, query.search, searchable, resolveSearchColumn(query.searchBy, searchable));
    const [items, total] = await this.incoming.findAndCount({
      select: INCOMING_COLUMNS,
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC", id: "DESC" },
      skip: query.offset,
      take: query.limit ?? 25,
    });
    return { items, total };
  }

  async incomingReport(id: number) {
    const report = await this.incoming.findOne({ where: { id }, select: INCOMING_COLUMNS });
    if (!report) throw new NotFoundException("No such DMARC report");
    const rows = await this.records.find({ where: { reportId: id }, order: { count: "DESC", id: "ASC" } });
    return { ...report, rows };
  }

  async incomingXml(id: number) {
    const report = await this.incoming.findOne({ where: { id }, select: { id: true, orgName: true, reportId: true, xml: true } });
    if (!report) throw new NotFoundException("No such DMARC report");
    return { filename: `${report.orgName}!${report.reportId}.xml`.replace(/[^\w.!@-]+/g, "_"), xml: report.xml };
  }

  async listOutgoing(query: DmarcOutgoingQuery): Promise<PaginatedResult<DmarcOutgoingReport>> {
    const sortBy = resolveSortColumn(query.sortBy, DMARC_OUTGOING_SORTABLE, "createdAt");
    const base: FindOptionsWhere<DmarcOutgoingReport> = {
      ...(query.domain ? { reporterDomain: query.domain } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const searchable = query.domain
      ? DMARC_OUTGOING_SEARCHABLE.filter((field) => field !== "reporterDomain")
      : DMARC_OUTGOING_SEARCHABLE;
    const where = searchWhere(base, query.search, searchable, resolveSearchColumn(query.searchBy, searchable));
    const [items, total] = await this.outgoing.findAndCount({
      select: OUTGOING_COLUMNS,
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC", id: "DESC" },
      skip: query.offset,
      take: query.limit ?? 25,
    });
    return { items, total };
  }

  async outgoingXml(id: number) {
    const report = await this.outgoing.findOne({
      where: { id },
      select: { id: true, reportId: true, recipient: true, xml: true },
    });
    if (!report) throw new NotFoundException("No such DMARC report");
    return { filename: `${report.reportId}.xml`.replace(/[^\w.!@-]+/g, "_"), xml: report.xml };
  }

  async retryOutgoing(id: number) {
    const row = await this.outgoing.findOne({ where: { id } });
    if (!row) throw new NotFoundException("No such DMARC report");
    const saved = await this.reporter.retry(row);
    const { xml: _xml, ...rest } = saved;
    return rest;
  }

  async runReports(day: string | undefined, now = Date.now()) {
    const window = day ? dayWindow(day) : previousDay(now);
    if (!Number.isFinite(window.begin) || window.end * 1000 >= Math.floor(now / 86_400_000) * 86_400_000) {
      throw new BadRequestException("Only a day that is over can be reported");
    }
    await this.ingest.ingest();
    await this.recipients.resolve();
    return this.reporter.run(window);
  }

  async listInbox(query: DmarcInboxQuery): Promise<PaginatedResult<DmarcInboxMessage>> {
    const sortBy = resolveSortColumn(query.sortBy, DMARC_INBOX_SORTABLE, "scannedAt");
    const base: FindOptionsWhere<DmarcInboxMessage> = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.domain ? { mailbox: Like(`%@${query.domain}`) } : {}),
    };
    const searchable = query.domain ? DMARC_INBOX_SEARCHABLE.filter((field) => field !== "mailbox") : DMARC_INBOX_SEARCHABLE;
    const where = searchWhere(base, query.search, searchable, resolveSearchColumn(query.searchBy, searchable));
    const [items, total] = await this.inboxMessages.findAndCount({
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC", id: "DESC" },
      skip: query.offset,
      take: query.limit ?? 25,
    });
    return { items, total };
  }

  scanInbox() {
    return this.inbox.scan();
  }

  getSettings() {
    return this.settings.get();
  }

  async updateSettings(input: DmarcSettingsDto) {
    const known = new Map((await this.mailboxes()).map((mailbox) => [mailbox.email.toLowerCase(), mailbox.reserved]));
    const copyTo = typeof input.copyTo === "string" ? input.copyTo.toLowerCase() : input.copyTo;
    const unknown = [...input.inboxes, ...(copyTo ? [copyTo] : [])].filter((email) => !known.has(email.toLowerCase()));
    if (unknown.length) throw new BadRequestException(`Not a mailbox of this server: ${unknown.join(", ")}`);
    if (copyTo && known.get(copyTo)) throw new BadRequestException(`A reserved mailbox cannot receive the copies: ${copyTo}`);
    return this.settings.update({
      ...input,
      inboxes: [...new Set(input.inboxes.map((email) => email.toLowerCase()))],
      copyTo,
    });
  }

  async mailboxes() {
    const users = await this.users.find({ select: { email: true, domain: true }, order: { email: "ASC" } });
    return users.map((user) => ({ email: user.email, reserved: reservedLocalPartOf(user.email, user.domain) }));
  }
}
