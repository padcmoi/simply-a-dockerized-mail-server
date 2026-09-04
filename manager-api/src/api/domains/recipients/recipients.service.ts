import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ApiError } from "../../../core/common/api-error";
import { resolveSearchColumn, resolveSortColumn, type PaginationQuery } from "../../../core/common/pagination.validation";
import { sha512crypt } from "../../../core/common/sha512-crypt";
import { Account } from "../../../core/entities/account.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualQuotaUser } from "../../../core/entities/virtual-quota-user.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { MailStorageService } from "../../../core/mail-storage/mail-storage.service";
import { DelegationsService } from "../delegations/delegations.service";
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
// `list()`) -- sorting by it takes a dedicated branch there. `ownerEmail` is
// joined the same way, from `accounts`: the table carries only `owner_id`, and
// ordering on a uuid reads as random.
export const RECIPIENTS_SORTABLE_COLUMNS = ["email", "quota", "active", "usedBytes", "ownerEmail", "lastActivity", "id"] as const;

// The columns a `searchBy` may name: the two addresses, which are what the
// free-text search spans when it names none. A quota, a byte count and a
// timestamp are read, not typed into a search box.
export const RECIPIENTS_SEARCHABLE_COLUMNS = ["email", "ownerEmail"] as const;

const RECIPIENT_SEARCH_EXPRESSIONS: Record<(typeof RECIPIENTS_SEARCHABLE_COLUMNS)[number], string> = {
  email: "r.email LIKE :search",
  ownerEmail: "o.email LIKE :search",
};

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
    private readonly recipientQuotas: Repository<VirtualQuotaUser>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    private readonly storage: MailStorageService,
    private readonly delegations: DelegationsService
  ) {}

  // Assign this recipient to an account. A recipient belongs to at most one
  // account, so assigning one already owned is refused: it must be released
  // first. postmaster@<domain> is never a real mailbox and is never owned.
  async assignOwner(id: number, domain: string, ownerId: string) {
    const recipient = await this.get(id, domain);
    if (isPostmaster(recipient.email, domain)) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "recipients.postmasterUnassignable",
        "postmaster@ cannot be assigned to an account",
        { id }
      );
    }
    if (recipient.ownerId) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        "recipients.alreadyAssigned",
        `Recipient #${id} is already assigned to an account`,
        { id }
      );
    }
    const account = await this.accounts.findOne({ where: { id: ownerId } });
    if (!account) throw new NotFoundException(`Account #${ownerId} not found`);
    recipient.ownerId = ownerId;
    return this.recipients.save(recipient);
  }

  // Release this recipient's owner (set it back to empty). Always allowed.
  async clearOwner(id: number, domain: string) {
    const recipient = await this.get(id, domain);
    recipient.ownerId = null;
    return this.recipients.save(recipient);
  }

  private async resolveOwnerEmail(ownerId: string | null): Promise<string | null> {
    if (!ownerId) return null;
    const account = await this.accounts.findOne({ where: { id: ownerId }, select: { email: true } });
    return account?.email ?? null;
  }

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
      .leftJoin(Account, "o", "o.id = r.ownerId")
      .addSelect("COALESCE(q.bytes, 0)", "usedBytes")
      .addSelect("o.email", "ownerEmail")
      .where("r.domain = :domain", { domain });
    if (query.search) {
      const searchBy = resolveSearchColumn(query.searchBy, RECIPIENTS_SEARCHABLE_COLUMNS);
      const expressions = searchBy ? [RECIPIENT_SEARCH_EXPRESSIONS[searchBy]] : Object.values(RECIPIENT_SEARCH_EXPRESSIONS);
      qb.andWhere(`(${expressions.join(" OR ")})`, { search: `%${query.search}%` });
    }

    const total = await qb.getCount();
    if (sortBy === "usedBytes") qb.orderBy("usedBytes", dir);
    else if (sortBy === "ownerEmail") qb.orderBy("ownerEmail", dir);
    else qb.orderBy(`r.${sortBy}`, dir);

    const { entities, raw } = await qb.skip(query.offset).take(query.limit).getRawAndEntities();
    const items = entities.map((entity, i) => ({
      ...entity,
      usedBytes: String(raw[i]?.usedBytes ?? "0"),
      ownerEmail: (raw[i] as { ownerEmail?: string | null } | undefined)?.ownerEmail ?? null,
    }));
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
    if (!found) {
      throw new ApiError(HttpStatus.NOT_FOUND, "recipients.notFound", `Recipient #${id} not found in ${domain}`, {
        id,
        domain,
      });
    }
    return found;
  }

  // The HTTP read wants usedBytes (dovecot's live counter, not a recipient
  // column) so the edit page can block a resize below current usage in the UI
  // itself, not only on save. The internal callers (update, remove) work off
  // the entity alone, so get() stays lean and this enrichment is opt-in.
  async getWithUsage(id: number, domain: string) {
    const found = await this.get(id, domain);
    const [withUsage] = await this.attachUsage([found]);
    return { ...withUsage, ownerEmail: await this.resolveOwnerEmail(found.ownerId) };
  }

  // The domain's own quota is the hard ceiling on what its recipients may
  // reserve between them -- the same rule DomainsService applies one level up,
  // where a domain can't claim more than the mail volume still has assignable.
  // `excludeRecipientId` leaves the recipient being resized out of the sum, so
  // its current reservation isn't counted against itself.
  //
  // `available` can be negative: quotas predating this rule may already
  // overcommit their domain. That is precisely why lowering a quota always
  // passes (see assertQuotaFitsDomain) -- otherwise such a domain could never
  // be brought back under its ceiling.
  async headroom(domain: string, excludeRecipientId?: number) {
    const parent = await this.domains.findOne({ where: { domain } });
    if (!parent) throw new NotFoundException(`Domain ${domain} not found`);

    const qb = this.recipients
      .createQueryBuilder("r")
      .select("COALESCE(SUM(r.quota), 0)", "allocated")
      .where("r.domain = :domain", { domain });
    if (excludeRecipientId !== undefined) qb.andWhere("r.id != :id", { id: excludeRecipientId });

    const row = await qb.getRawOne<{ allocated: string }>();
    const domainQuota = Number(parent.quota);
    const allocated = Number(row?.allocated ?? 0);
    // Delegation grants immobilize their unused quota against the domain from
    // the moment they exist, so what a new mailbox may take is what is left
    // after the mailboxes already reserved AND those pending grants.
    const reserved = domainQuota > 0 ? await this.delegations.reservedForAccountsBytes(parent.id) : 0;
    return { domainQuota, allocated, available: domainQuota - allocated - reserved };
  }

  // Shrinking a mailbox below what it already stores would leave it instantly
  // over quota, and dovecot would start bouncing its incoming mail. Read from
  // virtual_quota_users, dovecot's own counter; a mailbox it has never
  // delivered to has no row and reads as 0 bytes used.
  private async assertQuotaCoversUsage(email: string, quota: number) {
    const row = await this.recipientQuotas.findOne({ where: { email } });
    const used = Number(row?.bytes ?? 0);
    if (quota >= used) return;

    const mb = (bytes: number) => Math.ceil(bytes / (1024 * 1024));
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "recipients.quotaBelowUsage",
      `Recipient quota cannot be lowered below the ${mb(used)} MB ${email} already stores`,
      { email, usedMb: mb(used) }
    );
  }

  // `recipient` given = this is a resize: never refuse a value at or below what
  // it already holds, since it can only free space for the rest of the domain.
  private async assertQuotaFitsDomain(domain: string, quota: number, recipient?: { id: number; quota: number }) {
    if (recipient && quota <= recipient.quota) return;

    const { domainQuota, allocated, available } = await this.headroom(domain, recipient?.id);
    if (quota <= available) return;

    const mb = (bytes: number) => Math.floor(bytes / (1024 * 1024));
    const params = {
      domain,
      availableMb: mb(Math.max(available, 0)),
      domainQuotaMb: mb(domainQuota),
      allocatedMb: mb(allocated),
    };
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "recipients.quotaExceedsDomain",
      `Recipient quota exceeds what ${domain} has left: ${params.availableMb} MB available ` +
        `(domain quota ${params.domainQuotaMb} MB, ${params.allocatedMb} MB already allocated to other recipients)`,
      params
    );
  }

  // `opts.ownerId` stamps the mailbox as belonging to an account (the delegated
  // self-service path). `opts.skipDomainQuota` goes with it: the delegate's
  // grant was already immobilized against the domain, so the domain-level check
  // would count that space twice.
  async create(input: CreateRecipientDto, domain: string, opts: { ownerId?: string; skipDomainQuota?: boolean } = {}) {
    if (input.localPart.toLowerCase() === "postmaster") {
      throw new ApiError(
        HttpStatus.CONFLICT,
        "recipients.postmasterReserved",
        "postmaster@ is reserved and provisioned automatically for every domain"
      );
    }
    const email = `${input.localPart}@${domain}`;
    if (await this.recipients.findOne({ where: { email } })) {
      throw new ApiError(HttpStatus.CONFLICT, "recipients.alreadyExists", `Recipient ${email} already exists`, { email });
    }
    if (!opts.skipDomainQuota) await this.assertQuotaFitsDomain(domain, input.quota);
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
        ownerId: opts.ownerId ?? null,
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
  }

  // `opts.skipDomainQuota` mirrors create's: a delegate raising one of their
  // mailboxes spends a reserve already immobilized against the domain, so the
  // domain-level check would count that space twice.
  async update(id: number, input: UpdateRecipientDto, domain: string, opts: { skipDomainQuota?: boolean } = {}) {
    const current = await this.get(id, domain);
    if (isPostmaster(current.email, domain)) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "recipients.postmasterImmutable",
        "postmaster@ is managed automatically and cannot be modified"
      );
    }
    if (input.password) current.password = await sha512crypt(input.password);
    if (input.quota !== undefined) {
      await this.assertQuotaCoversUsage(current.email, input.quota);
      if (!opts.skipDomainQuota) await this.assertQuotaFitsDomain(domain, input.quota, { id, quota: Number(current.quota) });
      current.quota = String(input.quota);
    }
    if (input.active !== undefined) current.active = input.active ? 1 : 0;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.recipients.save(current);
  }

  // Two things outlive the `virtual_users` row unless taken out by hand.
  //
  // 1. The domain's quota aggregate. `virtual_quota_users` has an ON DELETE
  //    CASCADE onto `virtual_users.email`, so its row does disappear -- but
  //    MariaDB does not fire triggers for rows a foreign key cascade deletes,
  //    so `virtual_quota_users_after_delete_agg` never runs and
  //    `virtual_quota_domains` keeps counting the bytes and messages of a
  //    mailbox that no longer exists. Deleting the quota row explicitly, first,
  //    fires that trigger, which re-sums the surviving rows. The subtraction
  //    stays in the trigger on purpose: it already owns the aggregate (see
  //    1782760166966-CreateVirtualMail.ts), and a second copy of the arithmetic
  //    here would be one more thing to keep in step with dovecot's writes.
  //
  // 2. The mail on disk, which no foreign key reaches. Removed last, once the
  //    row is definitely gone.
  async remove(id: number, domain: string) {
    const current = await this.get(id, domain);
    if (isPostmaster(current.email, domain)) {
      throw new ApiError(HttpStatus.FORBIDDEN, "recipients.postmasterUndeletable", "postmaster@ cannot be deleted");
    }
    await this.recipientQuotas.delete({ email: current.email });
    await this.recipients.remove(current);
    await this.storage.removeRecipient(current.maildir, current.email);
    return { ok: true };
  }
}
