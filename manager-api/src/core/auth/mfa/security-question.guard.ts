import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ApiError } from "../../common/api-error";
import { MfaService } from "./mfa.service";

// The three routes an account with no security question may still call: the two
// that let it choose one, and the profile the interface reads to know it has to.
// Everything else waits.
const ALLOWED_EXACT = new Set(["/api/v1/auth/jwt/me"]);
const ALLOWED_PREFIX = "/api/v1/auth/jwt/me/security-question";

// A question nobody was ever made to answer is a fallback that does not exist
// on the day it is needed. So an account signed in without one is stopped here
// until it chooses, and the modal the interface shows is not what enforces
// that: a direct call to the API would walk around it.
//
// Only sessions. An API key acts within its scopes for a machine that will
// never see a question, and refusing it would break every integration over a
// human's forgotten prompt.
@Injectable()
export class SecurityQuestionGuard implements CanActivate {
  constructor(private readonly mfa: MfaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const accountId = req.user?.id;
    if (!accountId) return true;

    const authHeader = req.headers["authorization"];
    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) return true;

    const path = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
    if (ALLOWED_EXACT.has(path) || path.startsWith(ALLOWED_PREFIX)) return true;

    if ((await this.mfa.questionState(accountId)) !== "missing") return true;

    throw new ApiError(HttpStatus.FORBIDDEN, "securityQuestion.required", "Choose a security question before going any further");
  }
}
