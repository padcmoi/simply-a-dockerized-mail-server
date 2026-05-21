import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebadminAccount } from '../entities';
import { Sha512CryptService } from '../common/sha512-crypt.service';

type ExpiresIn = JwtSignOptions['expiresIn'];

@Injectable()
export class AuthService {
  private readonly accessExpiresIn: ExpiresIn;
  private readonly refreshExpiresIn: ExpiresIn;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    private readonly crypt: Sha512CryptService,
    @InjectRepository(WebadminAccount)
    private readonly webadmin: Repository<WebadminAccount>,
  ) {
    // ConfigService returns string ; jsonwebtoken's signOptions accepts `ms`-style strings.
    this.accessExpiresIn = (config.get<string>('ROOT_JWT_EXPIRES_IN') ?? '15m') as ExpiresIn;
    this.refreshExpiresIn = (config.get<string>('ROOT_REFRESH_EXPIRES_IN') ?? '7d') as ExpiresIn;
  }

  /**
   * Local login (email + password) - validates against `webadmin_accounts` table.
   * Returns access + refresh JWTs. Role is whatever the row carries (root/admin/owner/user).
   * Auth0 SSO is the parallel path - it doesn't go through here.
   */
  async loginLocal(email: string, password: string) {
    const account = await this.webadmin.findOne({
      where: { email: email.trim().toLowerCase(), is_active: 1 },
    });
    if (!account) {
      // Constant-time-ish failure - hash the input anyway to avoid trivial timing leaks.
      await this.crypt.hash(password).catch(() => undefined);
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await this.crypt.verify(password, account.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.webadmin.update({ id: account.id }, { last_login_at: new Date() });

    const claims = {
      sub: String(account.id),
      email: account.email,
      role: account.role,
    };
    const access_token = this.jwt.sign(
      { ...claims, scope: 'access' },
      { expiresIn: this.accessExpiresIn, issuer: 'manager-api' },
    );
    const refresh_token = this.jwt.sign(
      { ...claims, scope: 'refresh' },
      { expiresIn: this.refreshExpiresIn, issuer: 'manager-api' },
    );
    return {
      token_type: 'Bearer',
      access_token,
      refresh_token,
      expires_in: String(this.accessExpiresIn),
      principal: claims,
    };
  }

  async refreshLocal(refreshToken: string) {
    let payload: { sub?: string; email?: string; role?: string; scope?: string };
    try {
      payload = this.jwt.verify(refreshToken, { issuer: 'manager-api' });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.scope !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Refresh token has wrong scope');
    }
    const account = await this.webadmin.findOne({
      where: { id: Number(payload.sub), is_active: 1 },
    });
    if (!account) throw new UnauthorizedException('Account no longer active');
    const access_token = this.jwt.sign(
      { sub: payload.sub, email: account.email, role: account.role, scope: 'access' },
      { expiresIn: this.accessExpiresIn, issuer: 'manager-api' },
    );
    return { token_type: 'Bearer', access_token, expires_in: String(this.accessExpiresIn) };
  }
}
