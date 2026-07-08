import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import { resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { sha512crypt } from "../../../core/common/sha512-crypt";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
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
// fallback type-safe without a cast.
export const RECIPIENTS_SORTABLE_COLUMNS = ["email", "quota", "active", "id"] as const;

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
    private readonly domains: Repository<VirtualDomain>
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
  async list(domain: string, query: PaginationQuery) {
    if (query.limit === undefined) {
      return this.recipients.find({ where: { domain }, order: { email: "ASC" } });
    }
    const where = query.search ? { domain, email: Like(`%${query.search}%`) } : { domain };
    const sortBy = resolveSortColumn(query.sortBy, RECIPIENTS_SORTABLE_COLUMNS, "id");
    const [items, total] = await this.recipients.findAndCount({
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit,
    });
    return { items, total };
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
