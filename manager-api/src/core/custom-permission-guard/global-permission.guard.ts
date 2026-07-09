import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { CustomPermissionGuardService } from "./custom-permission-guard.service";
import { GlobalPermissionRequirement, REQUIRE_GLOBAL_PERMISSIONS_KEY } from "./require-permissions.decorator";

type PermissionRequest = Request & {
  user?: { id: number; username: string; isRoot: boolean };
};

// Built on top of assertOne/assertAll -- root bypass is NOT the lib's job
// (out of its scope by design), so it's handled here, before the lib is ever
// consulted.
@Injectable()
export class GlobalPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cpg: CustomPermissionGuardService
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<GlobalPermissionRequirement[] | undefined>(REQUIRE_GLOBAL_PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<PermissionRequest>();
    const user = req.user;
    if (!user) throw new ForbiddenException("Authentication required");
    if (user.isRoot === true) return true;

    for (const entry of required) {
      await this.cpg.guard.assertOne.global(user.id, entry.resource, { acrud: entry.actions });
    }
    return true;
  }
}
