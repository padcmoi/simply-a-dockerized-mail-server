import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import {
  AliasesApi,
  AssignAliasOwnerDocs,
  CreateAliasDocs,
  GetAliasDocs,
  ListAliasesDocs,
  RemoveAliasDocs,
  UnassignAliasOwnerDocs,
  UpdateAliasDocs,
} from "./aliases.openapi";
import { AliasesService } from "./aliases.service";
import {
  AssignAliasOwnerDto,
  CreateAliasDto,
  UpdateAliasDto,
  assignAliasOwnerSchema,
  createAliasSchema,
  updateAliasSchema,
} from "./aliases.validation";

@AliasesApi()
@Controller({ path: "domains/:domainId/aliases", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class AliasesController {
  constructor(private readonly svc: AliasesService) {}

  @Get()
  @RequireDomainPermissions([{ resource: "aliases", actions: ["access", "list-aliases"] }])
  @ListAliasesDocs()
  async list(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.list(domain, query);
  }

  @Get(":id")
  @RequireDomainPermissions([{ resource: "aliases", actions: ["access", "view-alias"] }])
  @GetAliasDocs()
  async get(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.getWithOwner(id, domain);
  }

  @Post()
  @RequireDomainPermissions([{ resource: "aliases", actions: ["access", "create-alias"] }])
  @CreateAliasDocs()
  async create(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(createAliasSchema)) body: CreateAliasDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.create(body, domain);
  }

  @Patch(":id")
  @RequireDomainPermissions([{ resource: "aliases", actions: ["access", "edit-alias"] }])
  @UpdateAliasDocs()
  async update(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateAliasSchema)) body: UpdateAliasDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.update(id, body, domain);
  }

  @Delete(":id")
  @RequireDomainPermissions([{ resource: "aliases", actions: ["access", "delete-alias"] }])
  @RemoveAliasDocs()
  async remove(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.remove(id, domain);
  }

  @Put(":id/owner")
  @RequireDomainPermissions([{ resource: "mailboxes", actions: ["access", "assign-alias-owner"] }])
  @AssignAliasOwnerDocs()
  async assignOwner(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(assignAliasOwnerSchema)) body: AssignAliasOwnerDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.assignOwner(id, domain, body.ownerId);
  }

  @Delete(":id/owner")
  @RequireDomainPermissions([{ resource: "mailboxes", actions: ["access", "unassign-alias-owner"] }])
  @UnassignAliasOwnerDocs()
  async clearOwner(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.clearOwner(id, domain);
  }
}
