import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { In, Not, Repository } from "typeorm";
import { Account } from "../../entities/account.entity";
import { GroupMember } from "../../entities/group-member.entity";
import { Group } from "../../entities/group.entity";
import { RefreshToken } from "../../entities/refresh-token.entity";
import { UpdateProfileDto } from "./jwt.validation";

export type ProfileResponse = {
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isRoot: boolean;
  groups: { id: number; name: string }[];
};

const ACCESS_TTL = Number(process.env.MANAGER_JWT_ACCESS_TTL ?? 900);
const REFRESH_TTL = Number(process.env.MANAGER_JWT_REFRESH_TTL ?? 2_592_000);

@Injectable()
export class JwtAuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>
  ) {}

  async login(username: string, password: string, ua?: string, ip?: string) {
    const account = await this.accounts.findOne({
      where: { username, enabled: 1 },
    });
    if (!account || !account.password) throw new UnauthorizedException("Invalid credentials");
    if (!(await bcrypt.compare(password, account.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    account.lastLogin = new Date();
    await this.accounts.save(account);
    return this.issueTokens(account, ua, ip);
  }

  async refresh(rawToken: string, ua?: string, ip?: string) {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hash(rawToken) },
      relations: ["account"],
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token invalid");
    }
    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueTokens(stored.account, ua, ip);
  }

  async revoke(rawToken: string) {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokens.save(stored);
    }
  }

  async me(accountId: number): Promise<ProfileResponse> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException("Account not found");
    return this.toProfile(account);
  }

  async updateProfile(accountId: number, input: UpdateProfileDto): Promise<ProfileResponse> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException("Account not found");
    if (input.email !== undefined && input.email !== null && input.email !== account.email) {
      const clash = await this.accounts.findOne({
        where: { email: input.email, id: Not(accountId) },
      });
      if (clash) throw new ConflictException(`Email ${input.email} is already used by another account`);
    }
    if (input.name !== undefined) account.name = input.name;
    if (input.email !== undefined) account.email = input.email;
    if (input.avatarUrl !== undefined) account.avatarUrl = input.avatarUrl;
    await this.accounts.save(account);
    return this.toProfile(account);
  }

  private async toProfile(account: Account): Promise<ProfileResponse> {
    const memberRows = await this.groupMembers.find({ where: { accountId: account.id } });
    const groupIds = memberRows.map((m) => m.groupId);
    const groupRows = groupIds.length ? await this.groups.findBy({ id: In(groupIds) }) : [];
    return {
      username: account.username,
      name: account.name,
      email: account.email,
      avatarUrl: account.avatarUrl,
      isRoot: account.isRoot === 1,
      groups: groupRows.map((g) => ({ id: g.id, name: g.name })),
    };
  }

  private async issueTokens(account: Account, userAgent?: string, ip?: string) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: account.id,
        username: account.username,
        isRoot: account.isRoot === 1,
      },
      { secret: process.env.MANAGER_JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL }
    );
    const refreshRaw = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
    await this.refreshTokens.insert({
      accountId: account.id,
      tokenHash: this.hash(refreshRaw),
      userAgent: userAgent ?? null,
      ip: ip ?? null,
      expiresAt,
      createdAt: new Date(),
    });
    return {
      accessToken,
      refreshToken: refreshRaw,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private hash(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }
}
