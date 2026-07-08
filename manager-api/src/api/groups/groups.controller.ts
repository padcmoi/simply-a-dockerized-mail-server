import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import {
  AddMemberDocs,
  CreateGroupDocs,
  GetGroupDocs,
  GetPermissionsCatalogDocs,
  GroupsApi,
  ListGroupsDocs,
  ListMembersDocs,
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
  CreateGroupDto,
  DOMAIN_RESOURCE_DEPENDS_ON,
  DOMAIN_RESOURCES,
  GLOBAL_RESOURCES,
  PERMISSION_ACTIONS,
  SetDomainPermissionsDto,
  SetGlobalPermissionsDto,
  UpdateGroupDto,
  UpdateOwnerDto,
  addMemberSchema,
  createGroupSchema,
  setDomainPermissionsSchema,
  setGlobalPermissionsSchema,
  updateGroupSchema,
  updateOwnerSchema,
} from "./groups.validation";

type AuthedRequest = Request & {
  user: { id: number; username: string; isRoot: boolean };
};

@GroupsApi()
@Controller({ path: "groups", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class GroupsController {
  constructor(private readonly svc: GroupsService) {}

  @Get()
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "read"] }])
  @ListGroupsDocs()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(query);
  }

  // Static catalog, not tied to any specific group -- the single source of
  // truth for GLOBAL_RESOURCES/DOMAIN_RESOURCES/PERMISSION_ACTIONS, so a
  // client never has to hardcode its own copy to build a permission grid.
  // `dependsOn` is included so a client can actually enforce it (e.g. a
  // resource with a dependency requires its prerequisite to be checked too)
  // instead of allowing a state the guard would silently treat as inert.
  @Get("permissions/catalog")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "read"] }])
  @GetPermissionsCatalogDocs()
  getPermissionsCatalog() {
    return {
      global: { resources: GLOBAL_RESOURCES, actions: PERMISSION_ACTIONS },
      domain: { resources: DOMAIN_RESOURCES, actions: PERMISSION_ACTIONS, dependsOn: DOMAIN_RESOURCE_DEPENDS_ON },
    };
  }

  @Post()
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "create"] }])
  @CreateGroupDocs()
  create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupDto) {
    return this.svc.create(req.user.id, req.user.id, body);
  }

  @Patch(":id")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "modify"] }])
  @UpdateGroupDocs()
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateGroupSchema)) body: UpdateGroupDto
  ) {
    return this.svc.update(id, req.user.id, body);
  }

  @Delete(":id")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "delete"] }])
  @RemoveGroupDocs()
  remove(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id, req.user);
  }

  @Get(":id")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "read"] }])
  @GetGroupDocs()
  getDetail(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getDetail(id);
  }

  @Put(":id/global-permissions")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "modify"] }])
  @SetGlobalPermissionsDocs()
  setGlobalPermissions(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(setGlobalPermissionsSchema)) body: SetGlobalPermissionsDto
  ) {
    return this.svc.setGlobalPermissions(id, req.user, body.permissions);
  }

  @Put(":id/domain-permissions")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "modify"] }])
  @SetDomainPermissionsDocs()
  setDomainPermissions(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(setDomainPermissionsSchema)) body: SetDomainPermissionsDto
  ) {
    return this.svc.setDomainPermissions(id, req.user, body.permissions);
  }

  // Owner transfer keeps its service-level owner-or-root check only, no
  // generic permission decorator (see GroupsService.updateOwner).
  @Patch(":id/owner")
  @UpdateOwnerDocs()
  updateOwner(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateOwnerSchema)) body: UpdateOwnerDto
  ) {
    return this.svc.updateOwner(id, req.user, body.newOwnerId);
  }

  @Get(":id/members")
  @RequireGlobalPermissions([{ resource: "groups", actions: ["access", "read"] }])
  @ListMembersDocs()
  listMembers(@Param("id", ParseIntPipe) id: number) {
    return this.svc.listMembers(id);
  }

  // Member add/remove keep their service-level owner-or-root check only, no
  // generic permission decorator (see GroupsService.addMember/removeMember).
  @Post(":id/members")
  @AddMemberDocs()
  addMember(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(addMemberSchema)) body: AddMemberDto
  ) {
    return this.svc.addMember(id, req.user, body.accountId);
  }

  @Delete(":id/members/:accountId")
  @RemoveMemberDocs()
  removeMember(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Param("accountId", ParseIntPipe) accountId: number
  ) {
    return this.svc.removeMember(id, req.user, accountId);
  }
}
