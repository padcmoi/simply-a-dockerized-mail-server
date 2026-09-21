import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { ensureDmarcReportsMailbox } from "./dmarc-mailbox";

@Injectable()
export class DmarcMailboxService implements OnApplicationBootstrap {
  private readonly log = new Logger(DmarcMailboxService.name);

  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    private readonly dataSource: DataSource
  ) {}

  async onApplicationBootstrap() {
    if (process.env.VITEST || process.env.NODE_ENV === "test") return;
    await this.ensureAll();
  }

  async ensureAll(): Promise<Record<string, number>> {
    const outcome: Record<string, number> = { created: 0, reactivated: 0, present: 0, failed: 0 };
    try {
      const domains = await this.domains.find({ select: { domain: true } });
      for (const { domain } of domains) {
        try {
          const result = await this.dataSource.transaction((manager) => ensureDmarcReportsMailbox(manager, domain));
          outcome[result] = (outcome[result] ?? 0) + 1;
          if (result !== "present") this.log.log(`dmarc_reports@${domain} ${result}`);
        } catch (e) {
          outcome.failed = (outcome.failed ?? 0) + 1;
          this.log.warn(`reserving dmarc_reports@${domain} failed: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.log.warn(`listing the domains for their DMARC report mailbox failed: ${(e as Error).message}`);
    }
    return outcome;
  }
}
