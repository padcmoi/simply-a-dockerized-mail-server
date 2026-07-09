import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { statfs } from "fs/promises";
import { In, Like, Repository } from "typeorm";
import { resolveSortColumn, type PaginationQuery } from "../../core/common/pagination.validation";
import { AuditLogService } from "../../core/audit/audit-log.service";
import { sha512crypt } from "../../core/common/sha512-crypt";
import { DkimKey, DkimService } from "../../core/dkim/dkim.service";
import { Account } from "../../core/entities/account.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../core/entities/virtual-quota-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { CreateDomainDto, UpdateDomainDto } from "./domains.validation";

type CallerCtx = { id: string; isRoot: boolean };

// `ownerUsername` (enriched post-query, see `attachOwnerUsername`) isn't a
// real column on `virtual_domains` -- not sortable without a join, out of
// scope here.
export const DOMAINS_SORTABLE_COLUMNS = ["id", "domain", "active", "quota"] as const;

@Injectable()
export class DomainsService {
  private readonly log = new Logger(DomainsService.name);

  constructor(
    @InjectRepository(VirtualDomain)
    private readonly repo: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser)
    private readonly users: Repository<VirtualUser>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(VirtualQuotaDomain)
    private readonly quotaDomains: Repository<VirtualQuotaDomain>,
    private readonly dkim: DkimService,
    private readonly auditLog: AuditLogService
  ) {}

  // Access is already gated by GlobalPermissionGuard/DomainPermissionGuard at
  // the controller level (group-based ACL, see CustomPermissionGuardService).
  //
  // `scope`: with global domains:read (or root), see every domain -- the
  // caller with only domains:access (no read) is scoped to domains they own,
  // same as being "root" over just their own rows (see DomainsController.list).
  //
  // `query.limit` absent = legacy unpaginated behavior, still relied on by
  // dashboard.vue, useDomainDashboard.ts, groups/[id]/index.vue and
  // profile.vue (they need the full domain list, not a page of 10).
  async list(query: PaginationQuery, scope: { callerId: string; canSeeAll: boolean }) {
    const ownerFilter = scope.canSeeAll ? {} : { ownerId: scope.callerId };

    if (query.limit === undefined) {
      const domains = await this.repo.find({ where: ownerFilter, order: { domain: "ASC" } });
      return this.attachUsage(await this.attachOwnerUsername(domains));
    }

    const where = query.search ? { ...ownerFilter, domain: Like(`%${query.search}%`) } : ownerFilter;
    const sortBy = resolveSortColumn(query.sortBy, DOMAINS_SORTABLE_COLUMNS, "id");
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit,
    });
    return { items: await this.attachUsage(await this.attachOwnerUsername(rows)), total };
  }

  async get(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Domain #${id} not found`);
    const [withOwner] = await this.attachOwnerUsername([found]);
    return withOwner;
  }

  // `virtual_domains.owner_id` is a plain FK column (no ORM relation), so the
  // owning account's username never comes back for free -- the UI's owner
  // display/transfer control (domains/[domain].vue) reads `ownerUsername`,
  // not the raw `ownerId`, so this must run on every list()/get() response.
  private async attachOwnerUsername<T extends VirtualDomain>(domains: T[]) {
    const ownerIds = [...new Set(domains.map((d) => d.ownerId).filter((id): id is string => id !== null))];
    const byId = new Map<string, string>();
    if (ownerIds.length) {
      const owners = await this.accounts.findBy({ id: In(ownerIds) });
      owners.forEach((o) => byId.set(o.id, o.username));
    }
    return domains.map((d) => ({ ...d, ownerUsername: d.ownerId !== null ? (byId.get(d.ownerId) ?? null) : null }));
  }

  // `virtual_quota_domains` is keyed by the FQDN string, not domainId (see
  // its own entity) -- no ORM relation to piggyback on, same enrich-after
  // pattern as attachOwnerUsername above. Drives the occupancy bar on the
  // domains list; a domain with no quota row yet (freshly created) reads as
  // 0 bytes used, not an error.
  private async attachUsage<T extends VirtualDomain>(domains: T[]) {
    const names = domains.map((d) => d.domain);
    const byDomain = new Map<string, string>();
    if (names.length) {
      const rows = await this.quotaDomains.find({ where: { domain: In(names) } });
      rows.forEach((r) => byDomain.set(r.domain, r.bytes));
    }
    return domains.map((d) => ({ ...d, usedBytes: byDomain.get(d.domain) ?? "0" }));
  }

  async disk() {
    const mountPath = process.env.MAIL_VOLUME_PATH ?? "/var/mail";
    const stats = await statfs(mountPath);
    const totalBytes = Number(stats.blocks) * stats.bsize;
    const freeBytes = Number(stats.bavail) * stats.bsize;
    const { sum } = await this.repo
      .createQueryBuilder("d")
      .select("COALESCE(SUM(CAST(d.quota AS UNSIGNED)), 0)", "sum")
      .getRawOne<{ sum: string }>()
      .then((r) => r ?? { sum: "0" });
    const reservedBytes = Number(sum);
    const assignableBytes = Math.max(0, Math.min(totalBytes, freeBytes + reservedBytes) - reservedBytes);
    return { totalBytes, freeBytes, reservedBytes, assignableBytes };
  }

  // The creating account becomes the domain's owner, with full scoped rights
  // on it (backend-acl-domain.md) -- this is never taken from the request
  // body, always from the authenticated caller.
  async create(input: CreateDomainDto, ownerId: string) {
    if (await this.repo.findOne({ where: { domain: input.domain } })) {
      throw new ConflictException(`Domain ${input.domain} already exists`);
    }
    const { assignableBytes } = await this.disk();
    if (input.quota > assignableBytes) {
      throw new BadRequestException(
        `Quota ${input.quota} exceeds the ${assignableBytes} bytes still assignable on the mail volume`
      );
    }
    const saved = await this.repo.save(
      this.repo.create({
        domain: input.domain,
        quota: String(input.quota),
        active: input.active ? 1 : 0,
        ownerId,
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
    await this.reservePostmaster(saved.domain);
    let dkim: DkimKey | null = null;
    try {
      dkim = await this.dkim.create(saved.domain);
    } catch (e) {
      this.log.warn(`DKIM key generation failed for ${saved.domain}: ${(e as Error).message}`);
    }
    return { ...saved, dkim };
  }

  // postmaster@<domain> is the envelope-from used by dovecot-lda for system
  // notifications (blocklist alerts, etc.); it must never authenticate or
  // accept inbound mail, so we always insert it inactive. Existing rows are
  // forced back to active=0 on every domain create so the invariant holds
  // even after a partial / aborted earlier run.
  private async reservePostmaster(domain: string) {
    const email = `postmaster@${domain}`;
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      if (existing.active !== 0) await this.users.save({ ...existing, active: 0 });
      return;
    }
    const password = await sha512crypt(randomBytes(24).toString("hex"));
    await this.users.save(
      this.users.create({
        email,
        domain,
        password,
        maildir: `${domain}/postmaster/`,
        quota: "0",
        active: 0,
        uid: "vmail",
        gid: "vmail",
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: null,
      })
    );
  }

  async update(id: number, input: UpdateDomainDto) {
    const current = await this.get(id);
    if (input.quota !== undefined && input.quota > 0) {
      const { assignableBytes } = await this.disk();
      const headroom = assignableBytes + Number(current.quota);
      if (input.quota > headroom) {
        throw new BadRequestException(`Quota ${input.quota} exceeds the ${headroom} bytes still assignable on the mail volume`);
      }
    }
    if (input.domain !== undefined) current.domain = input.domain;
    if (input.quota !== undefined) current.quota = String(input.quota);
    if (input.active !== undefined) current.active = input.active ? 1 : 0;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.repo.save(current);
  }

  async remove(id: number) {
    const target = await this.get(id);
    await this.dkim.removeAll(target.domain).catch((e) => {
      this.log.warn(`DKIM cleanup failed for ${target.domain}: ${(e as Error).message}`);
    });
    await this.repo.remove(target);
    return { ok: true };
  }

  // A domain must never end up without an owner (security-hardening.md
  // anti-lockout); this is the only path that may change `owner_id`, and it
  // always designates a new one.
  async transferOwner(id: number, actingUser: CallerCtx, newOwnerId: string) {
    const domain = await this.repo.findOne({ where: { id } });
    if (!domain) throw new NotFoundException(`Domain #${id} not found`);

    if (!actingUser.isRoot && domain.ownerId !== actingUser.id) {
      throw new ForbiddenException("Only root or the current domain owner can transfer ownership");
    }

    const newOwner = await this.accounts.findOne({ where: { id: newOwnerId } });
    if (!newOwner) throw new NotFoundException(`Account #${newOwnerId} not found`);

    const before = domain.ownerId;
    domain.ownerId = newOwnerId;
    await this.repo.save(domain);

    await this.auditLog.record({
      actorId: actingUser.id,
      action: "domain.owner.changed",
      entityType: "domain",
      entityId: id,
      before: { ownerId: before },
      after: { ownerId: newOwnerId },
    });

    return domain;
  }
}
