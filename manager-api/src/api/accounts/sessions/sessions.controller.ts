import { Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { JwtAuthService } from "../../../core/auth/jwt/jwt.service";
import { AccountsApi } from "../crud/crud.openapi";
import {
  AccountActiveSessionsDocs,
  AccountSessionHistoryDocs,
  PurgeAccountSessionsDocs,
  RevokeAccountSessionDocs,
  RevokeAllAccountSessionsDocs,
  SessionsOverviewDocs,
} from "./sessions.openapi";

// Admin, per-account session views. The data + revocation logic live in
// JwtAuthService (RefreshToken repo, DTO, online logic); this controller just
// scopes them by the target accountId, so an admin acts on that member's
// sessions without duplicating the logic.
@AccountsApi()
@Controller({ path: "accounts", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class AccountsSessionsController {
  constructor(private readonly jwtAuth: JwtAuthService) {}

  // Declared before the ":id/..." routes so "sessions/overview" is not captured
  // by ":id/overview" (which would then fail the UUID parse on "sessions").
  @Get("sessions/overview")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "view-account-sessions"] }])
  @SessionsOverviewDocs()
  sessionsOverview() {
    return this.jwtAuth.listSessionsOverview();
  }

  @Get(":id/sessions/active")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "view-account-sessions"] }])
  @AccountActiveSessionsDocs()
  accountActiveSessions(@Param("id", ParseUUIDPipe) id: string) {
    return this.jwtAuth.listActiveSessions(id);
  }

  @Get(":id/sessions/history")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "view-account-sessions"] }])
  @AccountSessionHistoryDocs()
  accountSessionHistory(
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    return this.jwtAuth.listSessionHistory(id, query);
  }

  // Declared before ":id/sessions/:sessionId" so "history" is not parsed as a
  // session id (ParseIntPipe would 400 on it).
  @Delete(":id/sessions/history")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "purge-account-sessions"] }])
  @PurgeAccountSessionsDocs()
  purgeAccountSessions(@Param("id", ParseUUIDPipe) id: string) {
    return this.jwtAuth.purgeAccountSessionHistory(id);
  }

  @Delete(":id/sessions/:sessionId")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "revoke-account-sessions"] }])
  @RevokeAccountSessionDocs()
  revokeAccountSession(@Param("id", ParseUUIDPipe) id: string, @Param("sessionId", ParseIntPipe) sessionId: number) {
    return this.jwtAuth.revokeSession(id, sessionId);
  }

  @Delete(":id/sessions")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "revoke-account-sessions"] }])
  @RevokeAllAccountSessionsDocs()
  revokeAllAccountSessions(@Param("id", ParseUUIDPipe) id: string) {
    return this.jwtAuth.revokeAllActiveSessions(id);
  }
}
