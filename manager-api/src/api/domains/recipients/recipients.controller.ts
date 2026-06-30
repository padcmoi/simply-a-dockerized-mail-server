import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
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
export class RecipientsController {
  constructor(private readonly svc: RecipientsService) {}

  @Get()
  @ListRecipientsDocs()
  async list(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.list(domain);
  }

  @Get(":id")
  @GetRecipientDocs()
  async get(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.get(id, domain);
  }

  @Post()
  @CreateRecipientDocs()
  async create(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(createRecipientSchema)) body: CreateRecipientDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.create(body, domain);
  }

  @Patch(":id")
  @UpdateRecipientDocs()
  async update(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateRecipientSchema)) body: UpdateRecipientDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.update(id, body, domain);
  }

  @Delete(":id")
  @RemoveRecipientDocs()
  async remove(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.remove(id, domain);
  }
}
