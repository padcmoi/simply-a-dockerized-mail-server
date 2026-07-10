import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { Public } from "../../core/auth/auth.decorator";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import {
  AcceptInvitationDocs,
  AccountsApi,
  GetAccountDocs,
  GetInvitationDocs,
  ListAccountNamesDocs,
  ListAccountsDocs,
  RevokeAccountDocs,
  SendInvitationDocs,
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
  user: { id: string; username: string; isRoot: boolean };
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
  constructor(private readonly svc: AccountsService) {}

  // Usernames only, no email/roles: this is what the group member picker reads,
  // hence `groups` depending on it (see permission-catalog.ts).
  @Get("names")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "list-account-names"] }])
  @ListAccountNamesDocs()
  listNames() {
    return this.svc.listNames();
  }

  @Get()
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "list-accounts"] }])
  @ListAccountsDocs()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(query);
  }

  @Get(":id")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "view-account"] }])
  @GetAccountDocs()
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.getById(id);
  }

  @Patch(":id")
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
    return this.svc.sendInvitation(req.user.id, body);
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
