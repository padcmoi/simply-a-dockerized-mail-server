import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Tries Auth0 RS256 first, falls back to the local HS256 root JWT.
 * Passport short-circuits on the first strategy that validates.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'local-jwt']) {}
