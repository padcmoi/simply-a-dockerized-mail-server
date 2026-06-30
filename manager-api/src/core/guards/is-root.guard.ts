import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class IsRootGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<{ user?: { isRoot: boolean } }>();
    if (req.user?.isRoot !== true) throw new ForbiddenException("Root access required");
    return true;
  }
}
