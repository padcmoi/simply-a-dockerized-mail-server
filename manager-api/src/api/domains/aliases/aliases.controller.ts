import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { AliasesApi, CreateAliasDocs, GetAliasDocs, ListAliasesDocs, RemoveAliasDocs, UpdateAliasDocs } from "./aliases.openapi";
import { AliasesService } from "./aliases.service";
import { CreateAliasDto, UpdateAliasDto, createAliasSchema, updateAliasSchema } from "./aliases.validation";

@AliasesApi()
@Controller({ path: "domains/:domainId/aliases", version: "1" })
export class AliasesController {
  constructor(private readonly svc: AliasesService) {}

  @Get()
  @ListAliasesDocs()
  async list(@Param("domainId", ParseIntPipe) domainId: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.list(domain);
  }

  @Get(":id")
  @GetAliasDocs()
  async get(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.get(id, domain);
  }

  @Post()
  @CreateAliasDocs()
  async create(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(createAliasSchema)) body: CreateAliasDto
  ) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.create(body, domain);
  }

  @Patch(":id")
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
  @RemoveAliasDocs()
  async remove(@Param("domainId", ParseIntPipe) domainId: number, @Param("id", ParseIntPipe) id: number) {
    const domain = await this.svc.resolveDomain(domainId);
    return this.svc.remove(id, domain);
  }
}
