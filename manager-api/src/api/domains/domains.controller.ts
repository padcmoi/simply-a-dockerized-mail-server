import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import {
  CreateDomainDocs,
  DiskUsageDocs,
  DomainsApi,
  GetDomainDocs,
  ListDomainsDocs,
  RemoveDomainDocs,
  UpdateDomainDocs,
} from "./domains.openapi";
import { DomainsService } from "./domains.service";
import { CreateDomainDto, UpdateDomainDto, createDomainSchema, updateDomainSchema } from "./domains.validation";

@DomainsApi()
@Controller({ path: "domains", version: "1" })
export class DomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Get()
  @ListDomainsDocs()
  list() {
    return this.svc.list();
  }

  @Get("disk")
  @DiskUsageDocs()
  disk() {
    return this.svc.disk();
  }

  @Get(":domainId")
  @GetDomainDocs()
  get(@Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.get(domainId);
  }

  @Post()
  @CreateDomainDocs()
  create(@Body(new ZodValidationPipe(createDomainSchema)) body: CreateDomainDto) {
    return this.svc.create(body);
  }

  @Patch(":domainId")
  @UpdateDomainDocs()
  update(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(updateDomainSchema)) body: UpdateDomainDto
  ) {
    return this.svc.update(domainId, body);
  }

  @Delete(":domainId")
  @RemoveDomainDocs()
  remove(@Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.remove(domainId);
  }
}
