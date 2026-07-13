import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import type { RspamdActions, RspamdDomainBayes, RspamdDomainStats } from "../../../core/rspamd/rspamd.service";
import { RspamdService } from "../../../core/rspamd/rspamd.service";
import { DomainRspamdApi, GetDomainRspamdHistoryDocs, GetDomainRspamdStatsDocs } from "./rspamd.openapi";

@DomainRspamdApi()
@Controller({ path: "domains/:domainId/rspamd", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DomainsRspamdController {
  constructor(
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser)
    private readonly users: Repository<VirtualUser>,
    private readonly rspamd: RspamdService
  ) {}

  private async resolveFqdn(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain.toLowerCase();
  }

  @Get("history")
  @RequireDomainPermissions([{ resource: "rspamd", actions: ["access", "view-rspamd-history"] }])
  @GetDomainRspamdHistoryDocs()
  async history(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Query("size") size: string | undefined,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    const fqdn = await this.resolveFqdn(domainId);
    return this.rspamd.history(fqdn, size ? parseInt(size, 10) : undefined, query);
  }

  @Get("stats")
  @RequireDomainPermissions([{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }])
  @GetDomainRspamdStatsDocs()
  async stats(@Param("domainId", ParseIntPipe) domainId: number): Promise<RspamdDomainStats> {
    const fqdn = await this.resolveFqdn(domainId);
    const rows = await this.rspamd.history(fqdn);
    const actions: RspamdActions = {
      reject: 0,
      "soft reject": 0,
      "rewrite subject": 0,
      "add header": 0,
      greylist: 0,
      "no action": 0,
    };
    for (const row of rows) {
      if (row.action in actions) actions[row.action as keyof RspamdActions]++;
    }
    // Bayes learns are per recipient. rspamd only holds a statfile for recipients
    // that have actually trained (moved a message to/out of Junk), so on its own
    // it shows nothing for a domain nobody has trained yet. List every mailbox of
    // the domain instead and fold in its learns (0 when untrained), so the card
    // mirrors "top mailboxes": the full recipient list, ranked by learns.
    const trained = await this.rspamd.domainBayes(fqdn);
    const mailboxes = await this.users.find({ where: { domain: fqdn }, select: { email: true } });
    const byEmail = new Map<string, RspamdDomainBayes["recipients"][number]>();
    for (const m of mailboxes) byEmail.set(m.email.toLowerCase(), { recipient: m.email, learnsHam: 0, learnsSpam: 0 });
    for (const r of trained.recipients) byEmail.set(r.recipient.toLowerCase(), r);
    const recipients = [...byEmail.values()].sort((a, b) => b.learnsHam + b.learnsSpam - (a.learnsHam + a.learnsSpam));
    const bayes: RspamdDomainBayes = { recipients, totalHam: trained.totalHam, totalSpam: trained.totalSpam };
    return { scanned: rows.length, actions, bayes };
  }
}
