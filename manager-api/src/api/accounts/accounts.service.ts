import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { In, IsNull, Repository } from "typeorm";
import { AccountDomainAcl } from "../../core/entities/account-domain-acl.entity";
import { AccountInvitation } from "../../core/entities/account-invitation.entity";
import { Account } from "../../core/entities/account.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { MailerService } from "../../core/mailer/mailer.service";
import type { AcceptInvitationDto, SendInvitationDto, SetAclDto } from "./accounts.validation";

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountInvitation)
    private readonly invitations: Repository<AccountInvitation>,
    @InjectRepository(AccountDomainAcl)
    private readonly acl: Repository<AccountDomainAcl>,
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>,
    private readonly mailer: MailerService
  ) {}

  async list() {
    const allAccounts = await this.accounts.find({
      order: { username: "ASC" },
    });
    const aclRows = await this.acl.find();
    const domainIds = [...new Set(aclRows.map((a) => a.domainId))];
    const domainMap = new Map<number, string>();
    if (domainIds.length) {
      const domList = await this.domains.findBy({ id: In(domainIds) });
      domList.forEach((d) => domainMap.set(d.id, d.domain));
    }
    return allAccounts.map((acc) => ({
      id: acc.id,
      username: acc.username,
      name: acc.name,
      email: acc.email,
      isRoot: acc.isRoot === 1,
      enabled: acc.enabled === 1,
      lastLogin: acc.lastLogin,
      createdAt: acc.createdAt,
      domains: aclRows
        .filter((a) => a.accountId === acc.id)
        .map((a) => ({
          id: a.domainId,
          domain: domainMap.get(a.domainId) ?? "",
        })),
    }));
  }

  async revokeAccount(id: number) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    if (account.isRoot === 1) throw new BadRequestException("Cannot revoke a root account");
    account.enabled = 0;
    await this.accounts.save(account);
    return { ok: true };
  }

  async getAcl(accountId: number) {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account #${accountId} not found`);
    const rows = await this.acl.find({ where: { accountId } });
    if (!rows.length) return { accountId, domains: [] };
    const domList = await this.domains.findBy({
      id: In(rows.map((r) => r.domainId)),
    });
    return {
      accountId,
      domains: rows.map((r) => ({
        id: r.domainId,
        domain: domList.find((d) => d.id === r.domainId)?.domain ?? "",
      })),
    };
  }

  async setAcl(accountId: number, input: SetAclDto) {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account #${accountId} not found`);
    if (input.domainIds.length) {
      const found = await this.domains.findBy({ id: In(input.domainIds) });
      if (found.length !== input.domainIds.length) throw new BadRequestException("One or more domain IDs not found");
    }
    await this.acl.delete({ accountId });
    if (input.domainIds.length) {
      await this.acl.insert(input.domainIds.map((domainId) => ({ accountId, domainId })));
    }
    return this.getAcl(accountId);
  }

  async sendInvitation(invitedBy: number, input: SendInvitationDto) {
    const existing = await this.invitations.findOne({
      where: { email: input.email, acceptedAt: IsNull() },
    });
    if (existing && existing.expiresAt > new Date()) {
      existing.expiresAt = new Date();
      await this.invitations.save(existing);
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.invitations.save(
      this.invitations.create({
        token,
        email: input.email,
        invitedBy,
        domainIds: input.domainIds,
        expiresAt,
      })
    );
    let domainNames: string[] = [];
    if (input.domainIds?.length) {
      const domList = await this.domains.findBy({ id: In(input.domainIds) });
      domainNames = domList.map((d) => d.domain);
    }
    const uiUrl = (process.env.MANAGER_UI_URL ?? "http://localhost").replace(/\/$/, "");
    await this.mailer.sendInvitation(input.email, `${uiUrl}/invite/${token}`, domainNames);
    return { ok: true };
  }

  async getInvitation(token: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    let domainNames: string[] = [];
    if (inv.domainIds?.length) {
      const domList = await this.domains.findBy({ id: In(inv.domainIds) });
      domainNames = domList.map((d) => d.domain);
    }
    return { email: inv.email, domains: domainNames, expiresAt: inv.expiresAt };
  }

  async acceptInvitation(token: string, input: AcceptInvitationDto) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    if (await this.accounts.findOne({ where: { username: input.username } })) {
      throw new ConflictException(`Username "${input.username}" is already taken`);
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const account = await this.accounts.save(
      this.accounts.create({
        username: input.username,
        name: input.name ?? null,
        email: inv.email,
        password: passwordHash,
        isRoot: 0,
        enabled: 1,
      })
    );
    if (inv.domainIds?.length) {
      await this.acl.insert(inv.domainIds.map((domainId) => ({ accountId: account.id, domainId })));
    }
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    return { ok: true, username: account.username };
  }
}
