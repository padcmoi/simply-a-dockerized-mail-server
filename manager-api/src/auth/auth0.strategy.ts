import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface Auth0Principal {
  sub: string;
  email?: string;
  scope?: string;
  permissions?: string[];
  // Auth0 custom claims (namespaced) - set via Auth0 Action / Rule
  roles?: string[];
}

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const domain = config.getOrThrow<string>('AUTH0_DOMAIN');
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.getOrThrow<string>('AUTH0_AUDIENCE'),
      issuer: config.getOrThrow<string>('AUTH0_ISSUER'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: Auth0Principal) {
    // Whatever we return becomes req.user
    return payload;
  }
}
