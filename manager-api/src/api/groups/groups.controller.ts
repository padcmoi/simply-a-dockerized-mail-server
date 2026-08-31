import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import {
  RequireGlobalPermissions,
  ServiceEnforcedGlobalPermissions,
} from "../../core/custom-permission-guard/require-permissions.decorator";
import {
  AddAllMembersDocs,
  AddMemberDocs,
  AddMembersDocs,
  CreateGroupDocs,
  GetGroupDocs,
  GetPermissionsCatalogDocs,
  GroupsApi,
  ListGroupsDocs,
  ListMembersDocs,
  RemoveAllMembersDocs,
  RemoveGroupDocs,
  RemoveMemberDocs,
  SetDomainPermissionsDocs,
  SetGlobalPermissionsDocs,
  UpdateGroupDocs,
  UpdateOwnerDocs,
} from "./groups.openapi";
import { GroupsService } from "./groups.service";
import {
  AddMemberDto,
  AddMembersDto,
  CreateGroupDto,
  DOMAIN_ACTIONS,
  DOMAIN_RESOURCE_DEPENDS_ON,
  DOMAIN_RESOURCES,
  GLOBAL_ACTIONS,
  GLOBAL_RESOURCES,
  GLOBAL_RESOURCES_DEPENDS_ON,
  SetDomainPermissionsDto,
  SetGlobalPermissionsDto,
  UpdateGroupDto,
  UpdateOwnerDto,
  addMemberSchema,
  addMembersSchema,
  createGroupSchema,
  setDomainPermissionsSchema,
  setGlobalPermissionsSchema,
  updateGroupSchema,
  updateOwnerSchema,
} from "./groups.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

@GroupsApi()
@Controller({ path: "groups", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class GroupsController {
  constructor(private readonly svc: GroupsService) {}

  @Get()
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "list-groups"] }])
  @ListGroupsDocs()
  list(@Req() req: AuthedRequest, @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(req.user, query);
  }

  // Static catalog, not tied to any specific group -- the single source of
  // truth for the resources and the actions each one offers, so a client never
  // has to hardcode its own copy to build a permission grid. Actions are keyed
  // by resource (`actionsByResource`) rather than a flat list: two resources no
  // longer share one vocabulary. `dependsOn` is included so a client can
  // actually enforce it (a resource with a dependency requires its prerequisite
  // to be checked too) instead of allowing a state the guard would treat as inert.
  @Get("permissions/catalog")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "view-group"] }])
  @GetPermissionsCatalogDocs()
  getPermissionsCatalog() {
    return {
      global: {
        resources: GLOBAL_RESOURCES,
        actionsByResource: GLOBAL_ACTIONS,
        dependsOn: GLOBAL_RESOURCES_DEPENDS_ON,
      },
      domain: {
        resources: DOMAIN_RESOURCES,
        actionsByResource: DOMAIN_ACTIONS,
        dependsOn: DOMAIN_RESOURCE_DEPENDS_ON,
      },
    };
  }

  @Post()
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "create-group"] }])
  @CreateGroupDocs()
  create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupDto) {
    return this.svc.create(req.user.id, req.user.id, body);
  }

  // Renaming a group is not editing what it can do -- see the two
  // .../permissions routes below, which carry their own actions.
  @Patch(":id")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "edit-group"] }])
  @UpdateGroupDocs()
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateGroupSchema)) body: UpdateGroupDto
  ) {
    return this.svc.update(id, req.user, body);
  }

  @Delete(":id")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "delete-group"] }])
  @RemoveGroupDocs()
  remove(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.svc.remove(id, req.user);
  }

  @Get(":id")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "view-group"] }])
  @GetGroupDocs()
  getDetail(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.svc.getDetail(id, req.user);
  }

  // The action anti-lockout protects (see lockoutProtected in
  // custom-permission-guard.service.ts): whoever holds this can hand out, or
  // take away, every other permission on the server.
  @Put(":id/global-permissions")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "edit-group-global-permissions"] }])
  @SetGlobalPermissionsDocs()
  setGlobalPermissions(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setGlobalPermissionsSchema)) body: SetGlobalPermissionsDto
  ) {
    return this.svc.setGlobalPermissions(id, req.user, body.permissions);
  }

  @Put(":id/domain-permissions")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "edit-group-domain-permissions"] }])
  @SetDomainPermissionsDocs()
  setDomainPermissions(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setDomainPermissionsSchema)) body: SetDomainPermissionsDto
  ) {
    return this.svc.setDomainPermissions(id, req.user, body.permissions);
  }

  // Enforced in GroupsService as "root OR the group's owner OR this action",
  // a disjunction a guard cannot express. Declared here so the action is typed
  // against the catalog and shows up in the permission table.
  @Patch(":id/owner")
  @ServiceEnforcedGlobalPermissions([{ resource: "groups", actions: ["access", "transfer-group-ownership"] }])
  @UpdateOwnerDocs()
  updateOwner(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOwnerSchema)) body: UpdateOwnerDto
  ) {
    return this.svc.updateOwner(id, req.user, body.newOwnerId);
  }

  @Get(":id/members")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "list-group-members"] }])
  @ListMembersDocs()
  listMembers(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    return this.svc.listMembers(id, req.user, query);
  }

  // Root-only bulk membership ops, not an ACL. The empty @RequireGlobalPermissions
  // is intentional: the guard short-circuits an empty requirement to allow-all,
  // so any authenticated caller clears the guard and the "root only" rule is
  // enforced in the service (GroupsService.addAllAccounts / removeAllMembers).
  // Declared before the :accountId routes so DELETE .../members/all is matched
  // as a static segment, never captured by :accountId.
  @Post(":id/members/all")
  @RequireGlobalPermissions([])
  @AddAllMembersDocs()
  addAllMembers(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.svc.addAllAccounts(id, req.user);
  }

  @Delete(":id/members/all")
  @RequireGlobalPermissions([])
  @RemoveAllMembersDocs()
  removeAllMembers(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.svc.removeAllMembers(id, req.user);
  }

  // Same disjunction as updateOwner above (see GroupsService.addMember).
  @Post(":id/members")
  @ServiceEnforcedGlobalPermissions([{ resource: "groups", actions: ["access", "add-group-member"] }])
  @AddMemberDocs()
  addMember(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addMemberSchema)) body: AddMemberDto
  ) {
    return this.svc.addMember(id, req.user, body.accountId);
  }

  // Bulk add (members picker multi-select). Same owner-or-root-or-permitted rule
  // as the single add, enforced in the service. Declared before the :accountId
  // routes so "bulk" is a static segment, never captured as an id.
  @Post(":id/members/bulk")
  @ServiceEnforcedGlobalPermissions([{ resource: "groups", actions: ["access", "add-group-member"] }])
  @AddMembersDocs()
  addMembers(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addMembersSchema)) body: AddMembersDto
  ) {
    return this.svc.addMembers(id, req.user, body.accountIds);
  }

  @Delete(":id/members/:accountId")
  @ServiceEnforcedGlobalPermissions([{ resource: "groups", actions: ["access", "remove-group-member"] }])
  @RemoveMemberDocs()
  removeMember(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("accountId", ParseUUIDPipe) accountId: string
  ) {
    return this.svc.removeMember(id, req.user, accountId);
  }
}
