import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auth0Strategy } from './auth0.strategy';
import { LocalJwtStrategy } from './local-jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SecretsService } from '../common/secrets.service';
import { Account, RefreshToken } from '../entities';

/**
 * Dual JWT validation :
 * - Auth0 (RS256 + JWKS) for the standard admin/owner/user population
 * - Local HS256 for accounts stored in `Accounts` (root bootstrapped by install.sh)
 *
 * Login flow : POST /api/v1/auth/login with email + password -> validated against
 * Accounts.password_hash (SHA512-CRYPT) -> returns access + refresh tokens. The refresh
 * token's `jti` is persisted in `RefreshTokens` so it can be revoked at any moment.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([Account, RefreshToken]),
    JwtModule.registerAsync({
      inject: [SecretsService],
      useFactory: (secrets: SecretsService) => ({
        secret: secrets.rootJwtSecret,
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  providers: [Auth0Strategy, LocalJwtStrategy, AuthService, JwtAuthGuard, RolesGuard],
  controllers: [AuthController],
  exports: [PassportModule, JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
