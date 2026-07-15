import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { Public } from "../../core/auth/auth.decorator";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { JwtAuthService } from "../../core/auth/jwt/jwt.service";
import {
  AcceptInvitationDocs,
  AccountActiveSessionsDocs,
  AccountSessionHistoryDocs,
  AccountsApi,
  GetAccountDocs,
  GetAccountOverviewDocs,
  GetInvitationDocs,
  ListAccountNamesDocs,
  ListAccountsDocs,
  PurgeAccountSessionsDocs,
  RevokeAccountDocs,
  RevokeAccountSessionDocs,
  RevokeAllAccountSessionsDocs,
  SendInvitationDocs,
  SessionsOverviewDocs,
  UpdateAccountDocs,
} from "./accounts.openapi";
import { AccountsService } from "./accounts.service";
import {
  AcceptInvitationDto,
  SendInvitationDto,
  UpdateAccountDto,
  acceptInvitationSchema,
  sendInvitationSchema,
  updateAccountSchema,
} from "./accounts.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

// Was root-only on every route but `names`, which made the whole `accounts`
// resource inert: a group could hold accounts:read and still be refused. The
// IsRootGuard that enforced it has been deleted, since root is a bypass rather
// than a gate -- GlobalPermissionGuard lets root through before the lib is ever
// consulted. So this grants nothing by itself; it lets an administrator delegate
// account management, which the resource always claimed to allow.
// See .trash/ACL_DECISIONS.md.
@AccountsApi()
@Controller({ path: "accounts", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class AccountsController {
  constructor(
    private readonly svc: AccountsService,
    // Session data + revocation live in JwtAuthService (RefreshToken repo, DTO,
    // online logic); reuse it here for the admin, per-account session views
    // instead of duplicating that logic. Its methods are already scoped by the
    // accountId we pass, so an admin acts on the target member's sessions.
    private readonly jwtAuth: JwtAuthService
  ) {}

  // Usernames only, no email/roles: this is what the group member picker reads,
  // hence `groups` depending on it (see permission-catalog.ts).
  @Get("names")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "list-account-names"] }])
  @ListAccountNamesDocs()
  listNames(@Query("notInGroup") notInGroup?: string, @Query("search") search?: string, @Query("limit") limit?: string) {
    // `limit` present => typeahead mode, capped to [1, 50] so a picker can never
    // dump the whole account table; absent => legacy full list.
    const parsedLimit = limit === undefined ? undefined : Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 25));
    return this.svc.listNames({ notInGroup, search: search?.trim() || undefined, limit: parsedLimit });
  }

  @Get()
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "list-accounts"] }])
  @ListAccountsDocs()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(query);
  }

  // Session routes are declared before the ":id" routes: "sessions/overview"
  // would otherwise be captured by ":id/overview" (and fail the UUID parse).
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

  @Get(":id")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "view-account"] }])
  @GetAccountDocs()
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.getById(id);
  }

  @Get(":id/overview")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "view-account"] }])
  @GetAccountOverviewDocs()
  overview(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.getOverview(id);
  }

  @Patch(":id/edit")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "edit-account"] }])
  @UpdateAccountDocs()
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountDto) {
    return this.svc.updateAccount(id, body);
  }

  @Delete(":id")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "revoke-account"] }])
  @RevokeAccountDocs()
  revoke(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.revokeAccount(id);
  }

  @Post("invite")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "invite-account"] }])
  @SendInvitationDocs()
  sendInvitation(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(sendInvitationSchema)) body: SendInvitationDto) {
    // Build the invite link from the real host the admin is on (behind the
    // reverse proxy), never a hard-coded/env default -- so it never points to
    // example.com.
    const fwdProto = req.headers["x-forwarded-proto"];
    const fwdHost = req.headers["x-forwarded-host"];
    const proto = (Array.isArray(fwdProto) ? fwdProto[0] : fwdProto)?.split(",")[0]?.trim() || req.protocol;
    const host = (Array.isArray(fwdHost) ? fwdHost[0] : fwdHost)?.split(",")[0]?.trim() || req.get("host") || "";
    return this.svc.sendInvitation(req.user, body, `${proto}://${host}`);
  }

  @Get("invite/:token")
  @Public()
  @GetInvitationDocs()
  getInvitation(@Param("token") token: string) {
    return this.svc.getInvitation(token);
  }

  @Post("invite/:token/accept")
  @Public()
  @AcceptInvitationDocs()
  acceptInvitation(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(acceptInvitationSchema))
    body: AcceptInvitationDto
  ) {
    return this.svc.acceptInvitation(token, body);
  }
}
