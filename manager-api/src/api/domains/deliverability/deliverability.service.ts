import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiError } from "../../../core/common/api-error";
import { DkimKeyEntity } from "../../../core/entities/dkim-key.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { askProbe } from "./deliverability.probe";
import { readStoredReport, storeReport } from "./deliverability.store";
import type { CheckResult, CheckStatus, DeliverabilityReport } from "./deliverability.types";

@Injectable()
export class DeliverabilityService {
  private readonly log = new Logger(DeliverabilityService.name);

  constructor(
    @InjectRepository(DkimKeyEntity) private readonly dkimKeys: Repository<DkimKeyEntity>,
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>
  ) {}

  // What the page shows is the stored report, and only the re-run button pays
  // for a new one: a run opens an SMTP session, fetches an HTTPS policy and
  // queries public blocklists in this installation's name, which is not a price
  // to pay for someone who opened the page to read what was found last time.
  async report(domain: string, refresh = false): Promise<DeliverabilityReport> {
    if (!refresh) {
      const stored = await readStoredReport(domain);
      if (stored) return stored;
    }
    const produced = await this.run(domain);
    await storeReport(produced);
    return produced;
  }

  // The network checks all live in the probe, which speaks from outside every
  // docker network. Two things it cannot know are added here, because they are
  // in this database and nowhere else: the selector the server signs with, which
  // is handed to the probe rather than guessed, and whether the role addresses
  // exist.
  private async run(domain: string): Promise<DeliverabilityReport> {
    const key = await this.dkimKeys.findOne({ where: { domain }, order: { updatedAt: "DESC" } });
    const { report, error } = await askProbe(domain, key?.selector ?? "");

    if (!report) {
      this.log.error(`Deliverability probe unreachable for ${domain}: ${error}`);
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "deliverability.probeUnavailable",
        "The deliverability probe did not answer",
        { detail: error ?? "" }
      );
    }

    const checks: CheckResult[] = [...report.checks, ...(await this.roleAddresses(domain))];
    const counts: Record<CheckStatus, number> = { pass: 0, warn: 0, fail: 0 };
    for (const check of checks) counts[check.status] += 1;

    return {
      domain: report.domain,
      checkedAt: new Date().toISOString(),
      mxHost: report.mxHost,
      mailIp: report.mailIp,
      probedFrom: report.source,
      counts,
      checks,
    };
  }

  // RFC 2142: some filters probe these, and a bounce on abuse@ reads as a domain
  // nobody is minding.
  //
  // What counts is whether mail to the address is actually delivered, not
  // whether a row bears its name. Creating a domain provisions a postmaster
  // mailbox that is disabled, so counting rows called the check green on an
  // address every message bounces off, which is the opposite of the truth.
  private async roleAddresses(domain: string): Promise<CheckResult[]> {
    const rows: CheckResult[] = [];
    for (const local of ["postmaster", "abuse"]) {
      const email = `${local}@${domain}`;
      const [existing, deliverable, asAlias] = await Promise.all([
        this.recipients.count({ where: { email } }),
        this.deliverableCount(email),
        this.aliases.count({ where: { source: email } }),
      ]);

      // Held either way: a mailbox postfix delivers to, or an alias pointing at
      // a recipient that is read. The alias is a first-class answer, not a
      // workaround, and the wording says so.
      //
      // An address that exists and refuses mail needs a different move from one
      // that does not exist: enabling a mailbox, rather than creating anything.
      const held = deliverable + asAlias > 0;
      rows.push({
        id: `role-${local}`,
        section: "server",
        status: held ? "pass" : "fail",
        evidence: held ? email : existing > 0 ? `${email} exists but is disabled` : `${email} does not exist`,
        params: { email, disabled: held ? 0 : existing },
      });
    }
    return rows;
  }

  // The conditions postfix itself applies in mysql-virtual-mailboxes.cf. Asking
  // a different question than the server asks is how a diagnostic ends up
  // disagreeing with reality.
  private deliverableCount(email: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    return this.recipients
      .createQueryBuilder("recipient")
      .where("recipient.email = :email", { email })
      .andWhere("recipient.active = 1")
      .andWhere("recipient.userStartDate <= :today", { today })
      .andWhere("(recipient.userEndDate IS NULL OR recipient.userEndDate >= :today)", { today })
      .getCount();
  }
}
