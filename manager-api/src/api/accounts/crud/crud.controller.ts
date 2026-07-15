import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import {
  AccountsApi,
  GetAccountDocs,
  GetAccountOverviewDocs,
  ListAccountNamesDocs,
  ListAccountsDocs,
  RevokeAccountDocs,
  UpdateAccountDocs,
} from "./crud.openapi";
import { AccountsService } from "./crud.service";
import { UpdateAccountDto, updateAccountSchema } from "./crud.validation";

// Core account management (CRUD). Session views live in AccountsSessionsModule
// and invitations in AccountsInvitationsModule (same folder), both aggregated by
// AccountsModule.
//
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
}
