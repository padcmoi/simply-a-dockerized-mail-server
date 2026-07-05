import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import {
  CreateRecipientDocs,
  GetRecipientDocs,
  ListRecipientsDocs,
  RecipientsApi,
  RemoveRecipientDocs,
  UpdateRecipientDocs,
} from "./recipients.openapi";
import { RecipientsService } from "./recipients.service";
import { CreateRecipientDto, UpdateRecipientDto, createRecipientSchema, updateRecipientSchema } from "./recipients.validation";

@RecipientsApi()
@Controller({ path: "domains/:domainId/recipients", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class RecipientsController {
  constructor(private readonly svc: RecipientsService) {}

  @Get()
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "read"] }])
  @ListRecipientsDocs()
  async list(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.list(domain);
  }

  @Get(":id")
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "read"] }])
  @GetRecipientDocs()
  async get(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.get(id, domain);
  }

  @Post()
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "create"] }])
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
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "modify"] }])
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
  @RequireDomainPermissions([{ resource: "recipients", actions: ["access", "delete"] }])
  @RemoveRecipientDocs()
  async remove(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.remove(id, domain);
  }
}
