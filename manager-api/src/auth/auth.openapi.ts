import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export const OpenApiLogin = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Local login (email + password)',
      description:
        'Validates credentials against the Accounts table (SHA512-CRYPT) and returns ' +
        'access + refresh JWTs. The refresh token jti is persisted in RefreshTokens, ' +
        'allowing per-session revocation later via /auth/logout or /auth/logout-all.',
    }),
    ApiOkResponse({ description: 'Bearer access_token + refresh_token + principal' }),
    ApiUnauthorizedResponse({ description: 'Invalid credentials' }),
  );

export const OpenApiRefresh = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Rotate the refresh token',
      description:
        'Verifies the refresh JWT, looks up its jti in RefreshTokens, revokes the consumed ' +
        'row and issues a fresh access + refresh pair with a new jti. Reusing a revoked token ' +
        'returns 401.',
    }),
    ApiOkResponse({ description: 'Fresh access_token + refresh_token' }),
    ApiUnauthorizedResponse({ description: 'Token invalid, revoked or expired' }),
  );

export const OpenApiLogout = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Revoke a single refresh token',
      description:
        'Marks the matching RefreshTokens row as revoked. Idempotent : already-revoked or ' +
        'unknown tokens return { revoked: false } without raising.',
    }),
    ApiOkResponse({ description: '{ revoked: boolean }' }),
  );

export const OpenApiLogoutAll = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Revoke every active refresh token for the current principal',
      description: 'Useful after a password rotation or a suspected leak.',
    }),
    ApiOkResponse({ description: '{ revoked: <number of rows> }' }),
    ApiUnauthorizedResponse({ description: 'Access token missing or invalid' }),
  );

export const OpenApiMe = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Current authenticated principal',
      description: 'Returns the decoded JWT claims (sub, email, role).',
    }),
    ApiOkResponse({ description: '{ principal: { sub, email, role } }' }),
    ApiUnauthorizedResponse({ description: 'Access token missing or invalid' }),
  );
