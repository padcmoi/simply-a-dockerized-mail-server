import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type Role = 'root' | 'admin' | 'owner' | 'user';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

interface RequestUser {
  roles?: string[];
  role?: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) return false;
    const userRoles = user.roles ?? (user.role ? [user.role] : []);

    // role=root is the highest privilege - bypasses every role requirement.
    if (userRoles.includes('root')) return true;

    return required.some((r) => userRoles.includes(r));
  }
}
