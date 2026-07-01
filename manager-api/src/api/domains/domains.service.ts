import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { statfs } from "fs/promises";
import { In, Repository } from "typeorm";
import { sha512crypt } from "../../core/common/sha512-crypt";
import { DkimKey, DkimService } from "../../core/dkim/dkim.service";
import { AccountDomainAcl } from "../../core/entities/account-domain-acl.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { CreateDomainDto, UpdateDomainDto } from "./domains.validation";

type CallerCtx = { id: number; isRoot: boolean };

@Injectable()
export class DomainsService {
  private readonly log = new Logger(DomainsService.name);

  constructor(
    @InjectRepository(VirtualDomain)
    private readonly repo: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser)
    private readonly users: Repository<VirtualUser>,
    @InjectRepository(AccountDomainAcl)
    private readonly acl: Repository<AccountDomainAcl>,
    private readonly dkim: DkimService
  ) {}

  async list(caller: CallerCtx) {
    if (caller.isRoot) return this.repo.find({ order: { domain: "ASC" } });
    const rows = await this.acl.find({ where: { accountId: caller.id } });
    if (!rows.length) return [];
    return this.repo.find({
      where: { id: In(rows.map((r) => r.domainId)) },
      order: { domain: "ASC" },
    });
  }

  async get(id: number, caller?: CallerCtx) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Domain #${id} not found`);
    if (caller && !caller.isRoot) {
      const allowed = await this.acl.findOne({
        where: { accountId: caller.id, domainId: id },
      });
      if (!allowed) throw new NotFoundException(`Domain #${id} not found`);
    }
    return found;
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

  async create(input: CreateDomainDto) {
    if (await this.repo.findOne({ where: { domain: input.domain } })) {
      throw new ConflictException(`Domain ${input.domain} already exists`);
    }
    if (input.quota && input.quota > 0) {
      const { assignableBytes } = await this.disk();
      if (input.quota > assignableBytes) {
        throw new BadRequestException(
          `Quota ${input.quota} exceeds the ${assignableBytes} bytes still assignable on the mail volume`
        );
      }
    }
    const saved = await this.repo.save(
      this.repo.create({
        domain: input.domain,
        quota: String(input.quota ?? 0),
        active: input.active ? 1 : 0,
        ownerId: input.ownerId ?? null,
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
    if (input.ownerId !== undefined) current.ownerId = input.ownerId;
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
}
