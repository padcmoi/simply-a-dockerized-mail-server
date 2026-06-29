import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AliasesApi, CreateAliasDocs, GetAliasDocs, ListAliasesDocs, RemoveAliasDocs, UpdateAliasDocs } from "./aliases.openapi";
import { AliasesService } from "./aliases.service";
import { CreateAliasDto, UpdateAliasDto, createAliasSchema, updateAliasSchema } from "./aliases.validation";

@AliasesApi()
@Controller({ path: "aliases", version: "1" })
export class AliasesController {
  constructor(private readonly svc: AliasesService) {}

  @Get()
  @ListAliasesDocs()
  list(@Query("domain") domain?: string) {
    return this.svc.list(domain);
  }

  @Get(":id")
  @GetAliasDocs()
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.get(id);
  }

  @Post()
  @CreateAliasDocs()
  create(@Body(new ZodValidationPipe(createAliasSchema)) body: CreateAliasDto) {
    return this.svc.create(body);
  }

  @Patch(":id")
  @UpdateAliasDocs()
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodValidationPipe(updateAliasSchema)) body: UpdateAliasDto) {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  @RemoveAliasDocs()
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
