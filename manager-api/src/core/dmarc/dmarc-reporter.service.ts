import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { promises as dns } from "dns";
import { gzipSync, strToU8 } from "fflate";
import { Between, LessThan, Repository } from "typeorm";
import { DmarcEvaluation } from "../entities/dmarc-evaluation.entity";
import { DmarcOutgoingReport } from "../entities/dmarc-outgoing-report.entity";
import { DmarcMailerService } from "./dmarc-mailer.service";
import { DmarcPslService } from "./dmarc-psl.service";
import { buildDmarcReport, publishedPolicyOf } from "./dmarc-report.builder";
import { domainOf, ruaTargets } from "./dmarc-rua";
import { dmarcReportsAddress } from "../common/reserved-mailboxes";
import { DmarcSettingsService, serverDomain } from "./dmarc-settings.service";
import type { DmarcAlignmentMode, DmarcEvaluationInput, DmarcPolicy, DmarcRuaTarget, DmarcVerdict } from "./dmarc.types";

const DAY_S = 86_400;

export interface DmarcDay {
  day: string;
  begin: number;
  end: number;
}

export interface DmarcRunSummary {
  day: string;
  domains: number;
  sent: number;
  failed: number;
  skipped: number;
  unchanged: number;
}

export function dayWindow(day: string): DmarcDay {
  const begin = Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000);
  return { day, begin, end: begin + DAY_S - 1 };
}

export function previousDay(now: number): DmarcDay {
  const today = Math.floor(now / 1000 / DAY_S) * DAY_S;
  return dayWindow(new Date((today - DAY_S) * 1000).toISOString().slice(0, 10));
}

export function toEvaluationInput(row: DmarcEvaluation): DmarcEvaluationInput {
  return {
    jobId: row.jobId,
    reporter: row.reporter,
    receivedAt: row.receivedAt,
    sourceIp: row.sourceIp,
    headerFrom: row.headerFrom,
    envelopeFrom: row.envelopeFrom,
    policyDomain: row.policyDomain,
    spfResult: row.spfResult,
    dkim: row.dkim ?? [],
    dkimAligned: row.dkimAligned as DmarcVerdict,
    spfAligned: row.spfAligned as DmarcVerdict,
    disposition: row.disposition as DmarcPolicy,
    policy: row.policy as DmarcPolicy | null,
    subdomainPolicy: row.subdomainPolicy as DmarcPolicy | null,
    adkim: row.adkim as DmarcAlignmentMode,
    aspf: row.aspf as DmarcAlignmentMode,
    pct: row.pct,
    rua: row.rua ?? [],
    recipientDomain: row.recipientDomain,
  };
}

@Injectable()
export class DmarcReporterService {
  private readonly log = new Logger(DmarcReporterService.name);
  private running = false;
  lastRunAt: number | null = null;
  lastSummary: DmarcRunSummary | null = null;

  constructor(
    @InjectRepository(DmarcEvaluation)
    private readonly evaluations: Repository<DmarcEvaluation>,
    @InjectRepository(DmarcOutgoingReport)
    private readonly outgoing: Repository<DmarcOutgoingReport>,
    private readonly settings: DmarcSettingsService,
    private readonly mailer: DmarcMailerService,
    private readonly psl: DmarcPslService
  ) {}

  async authorized(policyDomain: string, address: string): Promise<boolean> {
    const target = domainOf(address);
    const [ours, theirs] = await Promise.all([
      this.psl.organizationalDomain(policyDomain),
      this.psl.organizationalDomain(target),
    ]);
    if (ours === theirs) return true;
    try {
      const records = await dns.resolveTxt(`${policyDomain}._report._dmarc.${target}`);
      return records.some((chunks) => chunks.join("").trim().toLowerCase().startsWith("v=dmarc1"));
    } catch {
      return false;
    }
  }

  private async deliver(row: DmarcOutgoingReport, target: DmarcRuaTarget) {
    const gz = Buffer.from(gzipSync(strToU8(row.xml)));
    row.sizeBytes = gz.length;
    if (target.maxBytes !== null && gz.length > target.maxBytes) {
      row.status = "skipped";
      row.reason = "too-large";
      return;
    }
    if (!(await this.authorized(row.policyDomain, target.address))) {
      row.status = "skipped";
      row.reason = "not-authorized";
      return;
    }

    const receiver = row.reporterDomain;
    row.attempts += 1;
    try {
      await this.mailer.send({
        from: dmarcReportsAddress(receiver),
        fromName: receiver,
        to: target.address,
        subject: `Report Domain: ${row.policyDomain} Submitter: ${receiver} Report-ID: <${row.reportId}>`,
        text:
          `This is an aggregate DMARC report for ${row.policyDomain}, covering ` +
          `${new Date(row.periodBegin * 1000).toISOString()} to ${new Date(row.periodEnd * 1000).toISOString()}, ` +
          `sent by ${receiver}.`,
        filename: `${receiver}!${row.policyDomain}!${row.periodBegin}!${row.periodEnd}.xml.gz`,
        content: gz,
      });
      row.status = "sent";
      row.reason = null;
      row.sentAt = new Date();
    } catch (e) {
      row.status = "failed";
      row.reason = (e as Error).message.slice(0, 1024);
    }
  }

  async run(day: DmarcDay): Promise<DmarcRunSummary> {
    const summary: DmarcRunSummary = { day: day.day, domains: 0, sent: 0, failed: 0, skipped: 0, unchanged: 0 };
    if (this.running) return summary;
    this.running = true;
    try {
      const fallback = serverDomain();
      const rows = await this.evaluations.find({ where: { receivedAt: Between(day.begin * 1000, (day.end + 1) * 1000 - 1) } });
      const groups = new Map<string, { reporter: string; domain: string; evaluations: DmarcEvaluationInput[] }>();
      for (const row of rows) {
        const reporter = row.recipientDomain ?? fallback;
        const key = `${reporter} ${row.policyDomain}`;
        const group = groups.get(key) ?? { reporter, domain: row.policyDomain, evaluations: [] };
        group.evaluations.push(toEvaluationInput(row));
        groups.set(key, group);
      }

      for (const { reporter, domain, evaluations } of groups.values()) {
        const targets = ruaTargets(evaluations.flatMap((evaluation) => evaluation.rua));
        if (!targets.length) continue;
        summary.domains += 1;

        const reportId = `${domain}:${reporter}:${day.begin}`;
        const built = buildDmarcReport({
          orgName: reporter,
          email: dmarcReportsAddress(reporter),
          reportId,
          begin: day.begin,
          end: day.end,
          policy: publishedPolicyOf(domain, evaluations),
          evaluations,
        });

        for (const target of targets) {
          const existing = await this.outgoing.findOne({ where: { reportId, recipient: target.address } });
          if (existing?.status === "sent") {
            summary.unchanged += 1;
            continue;
          }
          const row =
            existing ??
            this.outgoing.create({
              reportId,
              reporterDomain: reporter,
              policyDomain: domain,
              recipient: target.address,
              periodBegin: day.begin,
              periodEnd: day.end,
              attempts: 0,
            });
          Object.assign(row, {
            reporterDomain: reporter,
            policyDomain: domain,
            periodBegin: day.begin,
            periodEnd: day.end,
            records: built.records,
            messages: built.messages,
            xml: built.xml,
          });
          await this.deliver(row, target);
          await this.outgoing.save(row);
          summary[row.status as "sent" | "failed" | "skipped"] += 1;
        }
      }

      this.lastRunAt = Date.now();
      this.lastSummary = summary;
      return summary;
    } finally {
      this.running = false;
    }
  }

  async retry(row: DmarcOutgoingReport): Promise<DmarcOutgoingReport> {
    if (row.status === "sent" || row.reason === "too-large") return row;
    const target = ruaTargets([`mailto:${row.recipient}`])[0] ?? { address: row.recipient, maxBytes: null };
    await this.deliver(row, target);
    return this.outgoing.save(row);
  }

  async prune(now: number): Promise<void> {
    try {
      const { retentionDays } = await this.settings.get();
      const cutoff = now - retentionDays * DAY_S * 1000;
      await this.evaluations.delete({ receivedAt: LessThan(cutoff) });
      await this.outgoing.delete({ createdAt: LessThan(new Date(cutoff)) });
    } catch (e) {
      this.log.warn(`pruning the DMARC history failed: ${(e as Error).message}`);
    }
  }
}
