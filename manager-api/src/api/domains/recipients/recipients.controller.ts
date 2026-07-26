import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import {
  AssignRecipientOwnerDocs,
  CreateRecipientDocs,
  GetRecipientDocs,
  GetRecipientsHeadroomDocs,
  ListRecipientsDocs,
  RecipientsApi,
  RemoveRecipientDocs,
  UnassignRecipientOwnerDocs,
  UpdateRecipientDocs,
} from "./recipients.openapi";
import { RecipientsService } from "./recipients.service";
import {
  AssignRecipientOwnerDto,
  CreateRecipientDto,
  UpdateRecipientDto,
  assignRecipientOwnerSchema,
  createRecipientSchema,
  updateRecipientSchema,
} from "./recipients.validation";

@RecipientsApi()
@Controller({ path: "domains/:domainId/recipients", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class RecipientsController {
  constructor(private readonly svc: RecipientsService) {}

  @Get()
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "list-recipients"] }])
  @ListRecipientsDocs()
  async list(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.list(domain, query);
  }

  // Declared before `@Get(":id")`: Nest matches in declaration order, and
  // "headroom" would otherwise hit that route and fail its ParseIntPipe.
  @Get("headroom")
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "view-recipient-headroom"] }])
  @GetRecipientsHeadroomDocs()
  async headroom(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.headroom(domain);
  }

  @Get(":id")
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "view-recipient"] }])
  @GetRecipientDocs()
  async get(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.getWithUsage(id, domain);
  }

  @Post()
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "create-recipient"] }])
  @CreateRecipientDocs()
  async create(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(createRecipientSchema))
    body: CreateRecipientDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.create(body, domain);
  }

  @Patch(":id")
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "edit-recipient"] }])
  @UpdateRecipientDocs()
  async update(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateRecipientSchema))
    body: UpdateRecipientDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.update(id, body, domain);
  }

  @Delete(":id")
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "delete-recipient"] }])
  @RemoveRecipientDocs()
  async remove(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.remove(id, domain);
  }

  @Put(":id/owner")
  @RequireDomainPermissions([{ resource: "mailboxes", actions: ["access", "assign-recipient-owner"] }])
  @AssignRecipientOwnerDocs()
  async assignOwner(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(assignRecipientOwnerSchema)) body: AssignRecipientOwnerDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.assignOwner(id, domain, body.ownerId);
  }

  @Delete(":id/owner")
  @RequireDomainPermissions([{ resource: "mailboxes", actions: ["access", "unassign-recipient-owner"] }])
  @UnassignRecipientOwnerDocs()
  async clearOwner(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.clearOwner(id, domain);
  }
}
