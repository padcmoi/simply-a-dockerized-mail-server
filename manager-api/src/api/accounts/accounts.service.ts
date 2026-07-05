import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { In, IsNull, Repository } from "typeorm";
import { AccountInvitation } from "../../core/entities/account-invitation.entity";
import { Account } from "../../core/entities/account.entity";
import { Group } from "../../core/entities/group.entity";
import { MailerService } from "../../core/mailer/mailer.service";
import type { AcceptInvitationDto, SendInvitationDto } from "./accounts.validation";

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountInvitation)
    private readonly invitations: Repository<AccountInvitation>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    private readonly mailer: MailerService
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
    const groupIds = [...new Set(allAccounts.map((acc) => acc.groupId).filter((id): id is number => id !== null))];
    const groupMap = new Map<number, string>();
    if (groupIds.length) {
      const groupRows = await this.groups.findBy({ id: In(groupIds) });
      groupRows.forEach((g) => groupMap.set(g.id, g.name));
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
      group: acc.groupId !== null ? { id: acc.groupId, name: groupMap.get(acc.groupId) ?? "" } : null,
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
        groupId: inv.groupId,
      })
    );
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    return { ok: true, username: account.username };
  }
}
