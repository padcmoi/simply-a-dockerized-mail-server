import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";
import { RefreshToken } from "../entities/refresh-token.entity";
import type { JwtPayload } from "./jwt/jwt.strategy";
import { AUTH_PUBLIC_KEY, AUTH_STRATEGIES_KEY, type AuthStrategy } from "./auth.decorator";
import { ApiTokenService } from "./api-token/api-token.service";
import { scopeAllowsDomain, scopeAllowsGlobal, type TokenScopes } from "./api-token/api-token.scopes";
import {
  REQUIRE_DOMAIN_PERMISSIONS_KEY,
  REQUIRE_GLOBAL_PERMISSIONS_KEY,
  type DomainPermissionRequirement,
  type GlobalPermissionRequirement,
} from "../custom-permission-guard/require-permissions.decorator";

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly apiTokenService: ApiTokenService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>
  ) {}

  // The access token is bound to its session (refresh token) via the `sid` claim.
  // Revoking or expiring that session makes this return false on the very next
  // request, so the token is rejected at once instead of lingering for its 15
  // minutes. Tokens with no sid predate session binding and are accepted (they
  // expire on their own shortly).
  private async sessionIsLive(payload: JwtPayload) {
    if (payload.sid === undefined) return true;
    const session = await this.refreshTokens.findOne({ where: { id: payload.sid } });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) return false;
    // Mark the session as seen, at most once every 30s. That keeps the "online
    // now" flag (last seen within a minute) accurate to ~1 minute without writing
    // on every single request. Fire-and-forget: never delay the request for it.
    if (!session.lastSeenAt || now.getTime() - session.lastSeenAt.getTime() > 30_000) {
      void this.refreshTokens.update(session.id, { lastSeenAt: now }).catch(() => undefined);
    }
    return true;
  }

  // A key may be narrower than the account it belongs to. The permission guards
  // enforce the account side and know nothing of keys; this enforces the scope
  // side, before them, and only ever refuses. The effective rights are the
  // intersection of the two.
  //
  // A route that demands no permission is refused outright to a scoped key.
  // Those are the routes guarded by ownership instead of by ACL - the caller's
  // own mailboxes, aliases and notifications, deletions included - and a key
  // narrowed to one resource has no business reaching them. An unscoped key
  // still does, exactly as before.
  private refuseOutOfScope(context: ExecutionContext, scopes: TokenScopes) {
    const req = context.switchToHttp().getRequest<Request & { params?: Record<string, string> }>();
    const where = () => `${req.method} ${req.originalUrl}`;

    const global = this.reflector.getAllAndOverride<GlobalPermissionRequirement[] | undefined>(REQUIRE_GLOBAL_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const domain = this.reflector.getAllAndOverride<DomainPermissionRequirement[] | undefined>(REQUIRE_DOMAIN_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!global?.length && !domain?.length) {
      throw new ForbiddenException(`This API key is scoped and may not call ${where()}`);
    }

    for (const entry of global ?? []) {
      if (!scopeAllowsGlobal(scopes, entry.resource, entry.actions)) {
        throw new ForbiddenException(`This API key is not scoped for ${entry.resource}[${entry.actions.join(", ")}]`);
      }
    }

    if (domain?.length) {
      const domainId = Number(req.params?.["domainId"]);
      if (!Number.isFinite(domainId)) throw new ForbiddenException(`This API key is scoped and may not call ${where()}`);
      for (const entry of domain) {
        if (!scopeAllowsDomain(scopes, domainId, entry.resource, entry.actions)) {
          throw new ForbiddenException(
            `This API key is not scoped for ${entry.resource}[${entry.actions.join(", ")}] on domain #${domainId}`
          );
        }
      }
    }
  }

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
            if (user.scopes) this.refuseOutOfScope(context, user.scopes);
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
            if (payload.sub && (await this.sessionIsLive(payload))) {
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
