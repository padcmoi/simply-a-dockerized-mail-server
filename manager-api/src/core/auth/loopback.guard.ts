import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const FORWARDED_HEADERS = ["x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded"];

@Injectable()
export class LoopbackGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const peer = req.socket.remoteAddress ?? "";
    const forwarded = FORWARDED_HEADERS.some((name) => req.headers[name] !== undefined);
    if (LOOPBACK.has(peer) && !forwarded) return true;
    throw new ForbiddenException("This route only answers the machine itself");
  }
}
