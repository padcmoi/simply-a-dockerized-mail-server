import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { sha512crypt } from "../../../core/common/sha512-crypt";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { CreateRecipientDto, UpdateRecipientDto } from "./recipients.validation";

// postmaster@<domain> is provisioned automatically by DomainsService.reservePostmaster
// (inactive, quota 0) and must stay that way for its lifetime: it's the
// envelope-from dovecot-lda uses for system notifications, never a real
// mailbox, so activating it, giving it quota, renaming it, or deleting it
// would either let it accept mail it must never accept or silently reserve
// disk space for nothing.
function isPostmaster(email: string, domain: string) {
  return email.toLowerCase() === `postmaster@${domain.toLowerCase()}`;
}

// `id` has no dedicated UI column/header (no createdAt on this table, see
// pagination.validation.ts's original design notes) but stays an accepted
// value since it's the existing default -- keeps `resolveSortColumn`'s
// fallback type-safe without a cast. `usedBytes` isn't a real virtual_users
// column (it's dovecot's own counter, joined from virtual_quota_users, see
// `list()`) -- sorting by it takes a dedicated branch there.
export const RECIPIENTS_SORTABLE_COLUMNS = ["email", "quota", "active", "usedBytes", "id"] as const;

// VirtualUser is the ORM mapping for the `virtual_users` postfix table; the
// table name is dictated by postfix conventions and not under our control.
// Everywhere else we speak in terms of "recipient" (RFC 5321 nomenclature):
// what postfix stores as `virtual_users.email` is the recipient address of
// inbound mail. This service is the public surface; the entity name stays
// `VirtualUser` so the entity-to-table mapping reads cleanly.
@Injectable()
export class RecipientsService {
  constructor(
    @InjectRepository(VirtualUser)
    private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualQuotaUser)
    private readonly recipientQuotas: Repository<VirtualQuotaUser>
  ) {}

  // Resolve the parent domain from `:domainId` and return its `domain`
  // string (FQDN). 404s on unknown parent: every nested handler must call
  // this first so its work never crosses a domain boundary.
  async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain;
  }

  // `query.limit` absent = legacy unpaginated behavior, still relied on by
  // dashboard.vue and useDomainDashboard.ts (need every recipient of a
  // domain for aggregation, not a page of 10).
  //
  // Sorting by `usedBytes` needs a real SQL-level join (not the simpler
  // enrich-after-pagination pattern used elsewhere, e.g. domains.service.ts's
  // attachUsage) since the sort must apply before the page window is cut --
  // an in-memory sort after findAndCount would only reorder within a page
  // already paginated by the wrong column.
  async list(domain: string, query: PaginationQuery) {
    if (query.limit === undefined) {
      const rows = await this.recipients.find({ where: { domain }, order: { email: "ASC" } });
      return this.attachUsage(rows);
    }

    const sortBy = resolveSortColumn(query.sortBy, RECIPIENTS_SORTABLE_COLUMNS, "id");
    const dir = query.sortDir === "asc" ? "ASC" : "DESC";
    const qb = this.recipients
      .createQueryBuilder("r")
      .leftJoin(VirtualQuotaUser, "q", "q.email = r.email")
      .addSelect("COALESCE(q.bytes, 0)", "usedBytes")
      .where("r.domain = :domain", { domain });
    if (query.search) qb.andWhere("r.email LIKE :search", { search: `%${query.search}%` });

    const total = await qb.getCount();
    if (sortBy === "usedBytes") qb.orderBy("usedBytes", dir);
    else qb.orderBy(`r.${sortBy}`, dir);

    const { entities, raw } = await qb.skip(query.offset).take(query.limit).getRawAndEntities();
    const items = entities.map((entity, i) => ({ ...entity, usedBytes: String(raw[i]?.usedBytes ?? "0") }));
    return { items, total };
  }

  // `virtual_quota_users` is keyed by the recipient's email, no ORM relation
  // to piggyback on -- same enrich-after pattern as domains.service.ts's
  // attachUsage. A recipient with no quota row yet (freshly created, dovecot
  // hasn't delivered to it) reads as 0 bytes used, not an error.
  private async attachUsage<T extends VirtualUser>(recipients: T[]) {
    const emails = recipients.map((r) => r.email);
    const byEmail = new Map<string, string>();
    if (emails.length) {
      const rows = await this.recipientQuotas.find({ where: { email: In(emails) } });
      rows.forEach((row) => byEmail.set(row.email, row.bytes));
    }
    return recipients.map((r) => ({ ...r, usedBytes: byEmail.get(r.email) ?? "0" }));
  }

  async get(id: number, domain: string) {
    const found = await this.recipients.findOne({ where: { id, domain } });
    if (!found) throw new NotFoundException(`Recipient #${id} not found in ${domain}`);
    return found;
  }

  async create(input: CreateRecipientDto, domain: string) {
    if (input.localPart.toLowerCase() === "postmaster") {
      throw new ConflictException("postmaster@ is reserved and provisioned automatically for every domain");
    }
    const email = `${input.localPart}@${domain}`;
    if (await this.recipients.findOne({ where: { email } })) {
      throw new ConflictException(`Recipient ${email} already exists`);
    }
    return this.recipients.save(
      this.recipients.create({
        email,
        domain,
        password: await sha512crypt(input.password),
        maildir: `${domain}/${input.localPart}/`,
        quota: String(input.quota),
        active: input.active === false ? 0 : 1,
        uid: "vmail",
        gid: "vmail",
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
  }

  async update(id: number, input: UpdateRecipientDto, domain: string) {
    const current = await this.get(id, domain);
    if (isPostmaster(current.email, domain)) {
      throw new ForbiddenException("postmaster@ is managed automatically and cannot be modified");
    }
    if (input.password) current.password = await sha512crypt(input.password);
    if (input.quota !== undefined) current.quota = String(input.quota);
    if (input.active !== undefined) current.active = input.active ? 1 : 0;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.recipients.save(current);
  }

  async remove(id: number, domain: string) {
    const current = await this.get(id, domain);
    if (isPostmaster(current.email, domain)) {
      throw new ForbiddenException("postmaster@ cannot be deleted");
    }
    await this.recipients.remove(current);
    return { ok: true };
  }
}
