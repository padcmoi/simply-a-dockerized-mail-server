import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
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
  SetDomainActiveDocs,
  TransferDomainOwnerDocs,
} from "./domains.openapi";
import { DomainsService } from "./domains.service";
import {
  CreateDomainDto,
  SetDomainActiveDto,
  TransferDomainOwnerDto,
  createDomainSchema,
  setDomainActiveSchema,
  transferDomainOwnerSchema,
} from "./domains.validation";

type AuthedRequest = Request & {
  user: { id: number; username: string; isRoot: boolean };
};

@DomainsApi()
@Controller({ path: "domains", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DomainsController {
  constructor(
    private readonly svc: DomainsService,
    private readonly cpg: CustomPermissionGuardService
  ) {}

  // `access` alone is the gate to reach this route at all -- who sees WHICH
  // rows is then scoped inside DomainsService.list: root or a real global
  // domains:read grant sees every domain, anyone else (access only) sees
  // just the domains they own (same "root over your own rows" precedent as
  // the rest of this ACL model).
  @Get()
  @RequireGlobalPermissions([{ resource: "domains", actions: ["access"] }])
  @ListDomainsDocs()
  async list(@Req() req: AuthedRequest, @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    const canSeeAll = req.user.isRoot || (await this.hasGlobalDomainsRead(req.user.id));
    return this.svc.list(query, { callerId: req.user.id, canSeeAll });
  }

  private async hasGlobalDomainsRead(accountId: number): Promise<boolean> {
    const effective = await this.cpg.guard.getEffectivePermissions(accountId);
    return effective.global.some((p) => p.resource === "domains" && p.action === "read");
  }

  @Get("disk")
  @RequireGlobalPermissions([{ resource: "domains", actions: ["access", "read"] }])
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

  // Rename / resize quota / delete moved OFF this controller entirely --
  // see AdminDomainsController (PATCH/DELETE /admin/domains/:domainId).
  // Kept fully separate on purpose: no plain /domains/:domainId PATCH/DELETE
  // exists anymore, so there's no ambiguous "which route did I just call"
  // surface for the 3 highest-risk domain actions.

  // Activating/deactivating is legitimate owner
  // self-service (not an identity/allocation change) -- deliberately kept on
  // the domain tier, 2 resources required together ("admin" + "domain"), so
  // ownership bypass still applies here on purpose.
  @Patch(":domainId/active")
  @RequireDomainPermissions([
    { resource: "admin", actions: ["access", "modify"] },
    { resource: "domain", actions: ["access", "modify"] },
  ])
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
