import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SecretsService } from '../common/secrets.service';

export interface LocalJwtPrincipal {
  sub: string;
  email: string;
  role: 'root' | 'admin' | 'owner' | 'user';
  scope?: 'access' | 'refresh';
}

@Injectable()
export class LocalJwtStrategy extends PassportStrategy(Strategy, 'local-jwt') {
  constructor(secrets: SecretsService) {
    super({
      secretOrKey: secrets.rootJwtSecret,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['HS256'],
      issuer: 'manager-api',
    });
  }

  validate(payload: LocalJwtPrincipal) {
    if (payload.scope && payload.scope !== 'access') return null;
    return { ...payload, roles: [payload.role] };
  }
}
