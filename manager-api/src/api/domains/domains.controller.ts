import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import {
  CreateDomainDocs,
  DomainsApi,
  GetDomainDocs,
  ListDkimDocs,
  ListDomainsDocs,
  RemoveDkimDocs,
  RemoveDomainDocs,
  RotateDkimDocs,
  UpdateDomainDocs,
} from "./domains.openapi";
import { DomainsService } from "./domains.service";
import { CreateDomainDto, UpdateDomainDto, createDomainSchema, updateDomainSchema } from "./domains.validation";

@DomainsApi()
@Controller("domains")
export class DomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Get()
  @ListDomainsDocs()
  list() {
    return this.svc.list();
  }

  @Get(":id")
  @GetDomainDocs()
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.get(id);
  }

  @Post()
  @CreateDomainDocs()
  create(@Body(new ZodValidationPipe(createDomainSchema)) body: CreateDomainDto) {
    return this.svc.create(body);
  }

  @Patch(":id")
  @UpdateDomainDocs()
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodValidationPipe(updateDomainSchema)) body: UpdateDomainDto) {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  @RemoveDomainDocs()
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }

  @Get(":id/dkim")
  @ListDkimDocs()
  async listDkim(@Param("id", ParseIntPipe) id: number) {
    const d = await this.svc.get(id);
    return this.svc.listDkim(d.domain);
  }

  @Post(":id/dkim/rotate")
  @RotateDkimDocs()
  async rotateDkim(@Param("id", ParseIntPipe) id: number) {
    const d = await this.svc.get(id);
    return this.svc.rotateDkim(d.domain);
  }

  @Delete(":id/dkim")
  @RemoveDkimDocs()
  async removeDkim(@Param("id", ParseIntPipe) id: number, @Query("selector") selector: string) {
    const d = await this.svc.get(id);
    return this.svc.removeDkim(d.domain, selector);
  }
}
