import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface JwtPayload {
  sub: string;
  email: string;
  isRoot: boolean;
  // Session (refresh token) id this access token was minted with. CombinedAuthGuard
  // rejects the token as soon as that session is revoked; older tokens carry none.
  sid?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.MANAGER_JWT_ACCESS_SECRET;
    if (!secret) throw new Error("MANAGER_JWT_ACCESS_SECRET is required");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) throw new UnauthorizedException();
    return {
      id: payload.sub,
      email: payload.email,
      isRoot: payload.isRoot === true,
    };
  }
}
