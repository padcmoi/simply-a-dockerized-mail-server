import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { Repository } from "typeorm";
import { Account } from "../../entities/account.entity";
import { RefreshToken } from "../../entities/refresh-token.entity";

const ACCESS_TTL = Number(process.env.MANAGER_JWT_ACCESS_TTL ?? 900);
const REFRESH_TTL = Number(process.env.MANAGER_JWT_REFRESH_TTL ?? 2_592_000);

@Injectable()
export class JwtAuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>
  ) {}

  async login(username: string, password: string, ua?: string, ip?: string) {
    const account = await this.accounts.findOne({ where: { username, enabled: 1 } });
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
    const stored = await this.refreshTokens.findOne({ where: { tokenHash: this.hash(rawToken) } });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokens.save(stored);
    }
  }

  private async issueTokens(account: Account, userAgent?: string, ip?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: account.id, username: account.username, role: account.role },
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
    return { accessToken, refreshToken: refreshRaw, expiresAt: expiresAt.toISOString() };
  }

  private hash(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }
}
