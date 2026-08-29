import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiError } from "../../../core/common/api-error";
import { DkimKeyEntity } from "../../../core/entities/dkim-key.entity";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { askProbe } from "./deliverability.probe";
import type { CheckResult, CheckStatus, DeliverabilityReport } from "./deliverability.types";

@Injectable()
export class DeliverabilityService {
  private readonly log = new Logger(DeliverabilityService.name);

  constructor(
    @InjectRepository(DkimKeyEntity) private readonly dkimKeys: Repository<DkimKeyEntity>,
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>
  ) {}

  // The network checks all live in the probe, which speaks from outside every
  // docker network. Two things it cannot know are added here, because they are
  // in this database and nowhere else: the selector the server signs with, which
  // is handed to the probe rather than guessed, and whether the role addresses
  // exist.
  async run(domain: string): Promise<DeliverabilityReport> {
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
  private async roleAddresses(domain: string): Promise<CheckResult[]> {
    const rows: CheckResult[] = [];
    for (const local of ["postmaster", "abuse"]) {
      const email = `${local}@${domain}`;
      const [asRecipient, asAlias] = await Promise.all([
        this.recipients.count({ where: { email } }),
        this.aliases.count({ where: { source: email } }),
      ]);
      rows.push({
        id: `role-${local}`,
        section: "server",
        status: asRecipient + asAlias > 0 ? "pass" : "warn",
        evidence: email,
      });
    }
    return rows;
  }
}
