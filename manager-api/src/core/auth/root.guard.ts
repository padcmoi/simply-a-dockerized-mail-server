import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class RootGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: { isRoot?: boolean } }>();
    if (req.user?.isRoot === true) return true;
    throw new ForbiddenException("Root access required");
  }
}
