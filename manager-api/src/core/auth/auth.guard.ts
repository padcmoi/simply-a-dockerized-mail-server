import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { JwtPayload } from "./jwt/jwt.strategy";
import { AUTH_PUBLIC_KEY, AUTH_STRATEGIES_KEY, type AuthStrategy } from "./auth.decorator";
import { ApiTokenService } from "./api-token/api-token.service";

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly apiTokenService: ApiTokenService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const strategies = this.reflector.getAllAndOverride<AuthStrategy[] | undefined>(AUTH_STRATEGIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Default when no @Auth() annotation: accept both strategies
    const active: AuthStrategy[] = strategies ?? ["ApiToken", "JWT"];

    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();

    for (const strategy of active) {
      if (strategy === "ApiToken") {
        const rawKey = req.headers["x-api-key"];
        if (rawKey && typeof rawKey === "string") {
          const user = await this.apiTokenService.validate(rawKey, req.ip ?? "");
          if (user) {
            req.user = user;
            return true;
          }
        }
      }

      if (strategy === "JWT") {
        const authHeader = req.headers["authorization"];
        if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
              secret: process.env.MANAGER_JWT_ACCESS_SECRET,
            });
            if (payload.sub) {
              req.user = { id: payload.sub, email: payload.email, isRoot: payload.isRoot === true };
              return true;
            }
          } catch {
            // invalid JWT, try next strategy
          }
        }
      }
    }

    throw new UnauthorizedException();
  }
}
