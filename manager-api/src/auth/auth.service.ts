import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { Account, RefreshToken } from '../entities';
import { Sha512CryptService } from '../common/sha512-crypt.service';

type ExpiresIn = JwtSignOptions['expiresIn'];

interface RefreshPayload {
  sub?: string;
  jti?: string;
  scope?: string;
}

interface ClientContext {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Local login (Accounts.username + Accounts.password_hash) issues HS256 JWTs.
 * Refresh tokens carry a `jti` UUID claim - the same jti is persisted in
 * `RefreshTokens` so that refresh + logout can revoke specific sessions without
 * having to rotate `root_jwt_secret` (which would log out everyone everywhere).
 */
@Injectable()
export class AuthService {
  private readonly accessExpiresIn: ExpiresIn;
  private readonly refreshExpiresIn: ExpiresIn;
  private readonly refreshTtlMs: number;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    private readonly crypt: Sha512CryptService,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {
    this.accessExpiresIn = (config.get<string>('ROOT_JWT_EXPIRES_IN') ?? '15m') as ExpiresIn;
    this.refreshExpiresIn = (config.get<string>('ROOT_REFRESH_EXPIRES_IN') ?? '7d') as ExpiresIn;
    this.refreshTtlMs = this.toMs(this.refreshExpiresIn);
  }

  async loginLocal(email: string, password: string, ctx: ClientContext = {}) {
    const username = email.trim().toLowerCase();
    const account = await this.accounts.findOne({ where: { username, is_active: 1 } });
    if (!account || !account.password_hash) {
      await this.crypt.hash(password).catch(() => undefined);
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await this.crypt.verify(password, account.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.accounts.update({ id: account.id }, { last_login_at: new Date() });
    await this.purgeExpired();
    return this.issueTokens(account, ctx);
  }

  async refreshLocal(refreshToken: string, ctx: ClientContext = {}) {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken, { issuer: 'manager-api' });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.scope !== 'refresh' || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('Refresh token has wrong scope');
    }

    const stored = await this.refreshTokens.findOne({ where: { jti: payload.jti } });
    if (!stored || stored.revoked_at || stored.expires_at <= new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    const account = await this.accounts.findOne({
      where: { id: stored.account_id, is_active: 1 },
    });
    if (!account) throw new UnauthorizedException('Account no longer active');

    // Rotate : revoke the consumed token, issue a fresh pair with a new jti.
    await this.refreshTokens.update(
      { id: stored.id },
      { revoked_at: new Date(), last_used_at: new Date() },
    );
    return this.issueTokens(account, ctx);
  }

  async logout(refreshToken: string) {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken, { issuer: 'manager-api' });
    } catch {
      return { revoked: false };
    }
    if (!payload.jti) return { revoked: false };
    const result = await this.refreshTokens.update(
      { jti: payload.jti, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
    return { revoked: (result.affected ?? 0) > 0 };
  }

  async logoutAll(accountId: number) {
    const result = await this.refreshTokens.update(
      { account_id: accountId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
    return { revoked: result.affected ?? 0 };
  }

  private async issueTokens(account: Account, ctx: ClientContext) {
    const claims = { sub: String(account.id), email: account.username, role: account.role };
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    const access_token = this.jwt.sign(
      { ...claims, scope: 'access' },
      { expiresIn: this.accessExpiresIn, issuer: 'manager-api' },
    );
    const refresh_token = this.jwt.sign(
      { ...claims, scope: 'refresh', jti },
      { expiresIn: this.refreshExpiresIn, issuer: 'manager-api', jwtid: jti },
    );

    await this.refreshTokens.save(
      this.refreshTokens.create({
        jti,
        account_id: account.id,
        expires_at: expiresAt,
        user_agent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
      }),
    );

    return {
      token_type: 'Bearer',
      access_token,
      refresh_token,
      expires_in: String(this.accessExpiresIn),
      principal: claims,
    };
  }

  private async purgeExpired() {
    // Best-effort cleanup of obviously-dead rows so the table doesn't grow unbounded.
    await this.refreshTokens.delete({ expires_at: LessThan(new Date()) }).catch(() => undefined);
  }

  private toMs(span: ExpiresIn): number {
    if (typeof span === 'number') return span * 1000;
    const m = String(span).match(/^(\d+)\s*([smhd])?$/i);
    if (!m) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(m[1]);
    switch ((m[2] ?? 's').toLowerCase()) {
      case 's':
        return n * 1000;
      case 'm':
        return n * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      case 'd':
        return n * 24 * 60 * 60 * 1000;
      default:
        return n * 1000;
    }
  }
}
