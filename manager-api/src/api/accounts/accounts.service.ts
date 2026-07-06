import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { In, IsNull, Not, Repository } from "typeorm";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
import { AccountInvitation } from "../../core/entities/account-invitation.entity";
import { Account } from "../../core/entities/account.entity";
import { GroupMember } from "../../core/entities/group-member.entity";
import { Group } from "../../core/entities/group.entity";
import { MailerService } from "../../core/mailer/mailer.service";
import type { AcceptInvitationDto, SendInvitationDto, UpdateAccountDto } from "./accounts.validation";

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountInvitation)
    private readonly invitations: Repository<AccountInvitation>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    private readonly mailer: MailerService,
    private readonly cpg: CustomPermissionGuardService
  ) {}

  async listNames() {
    const allAccounts = await this.accounts.find({
      select: ["id", "username", "name"],
      order: { username: "ASC" },
    });
    return allAccounts.map((acc) => ({ id: acc.id, username: acc.username, name: acc.name }));
  }

  async list() {
    const allAccounts = await this.accounts.find({
      order: { username: "ASC" },
    });
    const accountIds = allAccounts.map((acc) => acc.id);
    const memberRows = accountIds.length ? await this.groupMembers.find({ where: { accountId: In(accountIds) } }) : [];
    const groupIds = [...new Set(memberRows.map((m) => m.groupId))];
    const groupMap = new Map<number, string>();
    if (groupIds.length) {
      const groupRows = await this.groups.findBy({ id: In(groupIds) });
      groupRows.forEach((g) => groupMap.set(g.id, g.name));
    }
    const groupsByAccount = new Map<number, { id: number; name: string }[]>();
    memberRows.forEach((m) => {
      const list = groupsByAccount.get(m.accountId) ?? [];
      list.push({ id: m.groupId, name: groupMap.get(m.groupId) ?? "" });
      groupsByAccount.set(m.accountId, list);
    });
    return allAccounts.map((acc) => ({
      id: acc.id,
      username: acc.username,
      name: acc.name,
      email: acc.email,
      isRoot: acc.isRoot === 1,
      enabled: acc.enabled === 1,
      lastLogin: acc.lastLogin,
      createdAt: acc.createdAt,
      groups: groupsByAccount.get(acc.id) ?? [],
    }));
  }

  private async accountGroups(accountId: number) {
    const memberRows = await this.groupMembers.find({ where: { accountId } });
    if (!memberRows.length) return [];
    const groupRows = await this.groups.findBy({ id: In(memberRows.map((m) => m.groupId)) });
    return groupRows.map((g) => ({ id: g.id, name: g.name }));
  }

  async getById(id: number) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    return {
      id: account.id,
      username: account.username,
      name: account.name,
      email: account.email,
      avatarUrl: account.avatarUrl,
      isRoot: account.isRoot === 1,
      enabled: account.enabled === 1,
      lastLogin: account.lastLogin,
      createdAt: account.createdAt,
      groups: await this.accountGroups(id),
    };
  }

  async updateAccount(id: number, input: UpdateAccountDto) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    if (input.email !== undefined && input.email !== null && input.email !== account.email) {
      const clash = await this.accounts.findOne({ where: { email: input.email, id: Not(id) } });
      if (clash) throw new ConflictException(`Email ${input.email} is already used by another account`);
    }
    if (input.name !== undefined) account.name = input.name;
    if (input.email !== undefined) account.email = input.email;
    if (input.avatarUrl !== undefined) account.avatarUrl = input.avatarUrl;
    if (input.enabled !== undefined) {
      if (account.isRoot === 1 && !input.enabled) throw new BadRequestException("Cannot disable a root account");
      account.enabled = input.enabled ? 1 : 0;
    }
    await this.accounts.save(account);
    return this.getById(id);
  }

  async revokeAccount(id: number) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    if (account.isRoot === 1) throw new BadRequestException("Cannot revoke a root account");
    account.enabled = 0;
    await this.accounts.save(account);
    return { ok: true };
  }

  async sendInvitation(invitedBy: number, input: SendInvitationDto) {
    const existing = await this.invitations.findOne({
      where: { email: input.email, acceptedAt: IsNull() },
    });
    if (existing && existing.expiresAt > new Date()) {
      existing.expiresAt = new Date();
      await this.invitations.save(existing);
    }

    let group: Group | null = null;
    if (input.groupId) {
      group = await this.groups.findOne({ where: { id: input.groupId } });
      if (!group) throw new NotFoundException(`Group #${input.groupId} not found`);
    } else {
      group = await this.groups.findOne({ where: { isDefault: 1 } });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.invitations.save(
      this.invitations.create({
        token,
        email: input.email,
        invitedBy,
        groupId: group?.id ?? null,
        expiresAt,
      })
    );

    const uiUrl = (process.env.MANAGER_UI_URL ?? "http://localhost").replace(/\/$/, "");
    await this.mailer.sendInvitation(input.email, `${uiUrl}/invite/${token}`, group?.name ?? null);
    return { ok: true };
  }

  async getInvitation(token: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException("Invitation not found");
    if (inv.acceptedAt) throw new BadRequestException("Invitation already used");
    if (inv.expiresAt < new Date()) throw new BadRequestException("Invitation expired");
    let groupName: string | null = null;
    if (inv.groupId !== null) {
      const group = await this.groups.findOne({ where: { id: inv.groupId } });
      groupName = group?.name ?? null;
    }
    return { email: inv.email, groupName, expiresAt: inv.expiresAt };
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
    if (inv.groupId !== null) {
      await this.cpg.guard.assignAccountToGroup(account.id, inv.groupId);
    }
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    return { ok: true, username: account.username };
  }
}
