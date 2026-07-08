import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import {
  RequireDomainPermissions,
  RequireGlobalPermissions,
} from "../../core/custom-permission-guard/require-permissions.decorator";
import {
  CreateDomainDocs,
  DiskUsageDocs,
  DomainsApi,
  GetDomainDocs,
  ListDomainsDocs,
  RemoveDomainDocs,
  SetDomainActiveDocs,
  TransferDomainOwnerDocs,
  UpdateDomainDocs,
} from "./domains.openapi";
import { DomainsService } from "./domains.service";
import {
  CreateDomainDto,
  SetDomainActiveDto,
  TransferDomainOwnerDto,
  UpdateDomainDto,
  createDomainSchema,
  setDomainActiveSchema,
  transferDomainOwnerSchema,
  updateDomainSchema,
} from "./domains.validation";

type AuthedRequest = Request & {
  user: { id: number; username: string; isRoot: boolean };
};

@DomainsApi()
@Controller({ path: "domains", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Get()
  @RequireGlobalPermissions([{ resource: "domains", actions: ["access", "read"] }])
  @ListDomainsDocs()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(query);
  }

  // Disk capacity overview is visible with `domains.access` alone -- it's
  // aggregate stats, not the domain list itself. `domains.read` is what
  // gates the actual per-domain list (see `list()` above).
  @Get("disk")
  @RequireGlobalPermissions([{ resource: "domains", actions: ["access"] }])
  @DiskUsageDocs()
  disk() {
    return this.svc.disk();
  }

  @Get(":domainId")
  @RequireDomainPermissions([{ resource: "domain", actions: ["access", "read"] }])
  @GetDomainDocs()
  get(@Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.get(domainId);
  }

  // Domain creation is a global act (domains.create); the creating account
  // becomes the domain's owner (see DomainsService.create).
  @Post()
  @RequireGlobalPermissions([{ resource: "domains", actions: ["access", "create"] }])
  @CreateDomainDocs()
  create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(createDomainSchema)) body: CreateDomainDto) {
    return this.svc.create(body, req.user.id);
  }

  @Patch(":domainId")
  @RequireDomainPermissions([{ resource: "domain", actions: ["access", "modify"] }])
  @UpdateDomainDocs()
  update(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(updateDomainSchema)) body: UpdateDomainDto
  ) {
    return this.svc.update(domainId, body);
  }

  @Delete(":domainId")
  @RequireDomainPermissions([{ resource: "domain", actions: ["access", "delete"] }])
  @RemoveDomainDocs()
  remove(@Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.remove(domainId);
  }

  // Dedicated route, gated by the "admin" domain resource rather than the
  // general "domain" modify used by update() above -- activating/deactivating
  // a domain's mail acceptance is an Administration-page action.
  @Patch(":domainId/active")
  @RequireDomainPermissions([{ resource: "admin", actions: ["access", "modify"] }])
  @SetDomainActiveDocs()
  setActive(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(setDomainActiveSchema)) body: SetDomainActiveDto
  ) {
    return this.svc.update(domainId, { active: body.active });
  }

  // Ownership transfer keeps its own service-level owner-or-root check, no
  // generic permission decorator (see DomainsService.transferOwner).
  @Patch(":domainId/owner")
  @TransferDomainOwnerDocs()
  transferOwner(
    @Req() req: AuthedRequest,
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(transferDomainOwnerSchema)) body: TransferDomainOwnerDto
  ) {
    return this.svc.transferOwner(domainId, { id: req.user.id, isRoot: req.user.isRoot }, body.newOwnerId);
  }
}
