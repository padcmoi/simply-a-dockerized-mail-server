import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import {
  AccountsApi,
  AssignableResourcesDocs,
  AttachResourceDocs,
  DetachResourceDocs,
  GetAccountDocs,
  GetAccountOverviewDocs,
  ListAccountNamesDocs,
  ListAccountsDocs,
  DeleteAccountDocs,
  OwnedResourcesDocs,
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
  @DeleteAccountDocs()
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.deleteAccount(id);
  }

  // Ownership management (global): a recipient/alias belongs to at most one
  // account. Viewing owned + assignable and attaching are gated by the assign
  // action; detaching by the unassign action. postmaster@ is never ownable.
  @Get(":id/recipients")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "assign-recipient-owner"] }])
  @OwnedResourcesDocs()
  ownedRecipients(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.ownedRecipients(id);
  }

  @Get(":id/recipients/assignable")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "assign-recipient-owner"] }])
  @AssignableResourcesDocs()
  assignableRecipients(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("domainId") domainId?: string,
    @Query("search") search?: string
  ) {
    return this.svc.assignableRecipients(domainId ? Number(domainId) : undefined, search?.trim() || undefined);
  }

  @Post(":id/recipients/:recipientId")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "assign-recipient-owner"] }])
  @AttachResourceDocs()
  attachRecipient(@Param("id", ParseUUIDPipe) id: string, @Param("recipientId", ParseIntPipe) recipientId: number) {
    return this.svc.attachRecipient(id, recipientId);
  }

  @Delete(":id/recipients/:recipientId")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "unassign-recipient-owner"] }])
  @DetachResourceDocs()
  detachRecipient(@Param("id", ParseUUIDPipe) id: string, @Param("recipientId", ParseIntPipe) recipientId: number) {
    return this.svc.detachRecipient(id, recipientId);
  }

  @Get(":id/aliases")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "assign-alias-owner"] }])
  @OwnedResourcesDocs()
  ownedAliases(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.ownedAliases(id);
  }

  @Get(":id/aliases/assignable")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "assign-alias-owner"] }])
  @AssignableResourcesDocs()
  assignableAliases(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("domainId") domainId?: string,
    @Query("search") search?: string
  ) {
    return this.svc.assignableAliases(domainId ? Number(domainId) : undefined, search?.trim() || undefined);
  }

  @Post(":id/aliases/:aliasId")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "assign-alias-owner"] }])
  @AttachResourceDocs()
  attachAlias(@Param("id", ParseUUIDPipe) id: string, @Param("aliasId", ParseIntPipe) aliasId: number) {
    return this.svc.attachAlias(id, aliasId);
  }

  @Delete(":id/aliases/:aliasId")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "unassign-alias-owner"] }])
  @DetachResourceDocs()
  detachAlias(@Param("id", ParseUUIDPipe) id: string, @Param("aliasId", ParseIntPipe) aliasId: number) {
    return this.svc.detachAlias(id, aliasId);
  }
}
