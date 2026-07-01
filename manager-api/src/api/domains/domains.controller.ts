import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { IsRootGuard } from "../../core/guards/is-root.guard";
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

type AuthedRequest = Request & {
  user: { id: number; username: string; isRoot: boolean };
};

@DomainsApi()
@Controller({ path: "domains", version: "1" })
export class DomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Get()
  @ListDomainsDocs()
  list(@Req() req: AuthedRequest) {
    return this.svc.list({ id: req.user.id, isRoot: req.user.isRoot });
  }

  @Get("disk")
  @DiskUsageDocs()
  disk() {
    return this.svc.disk();
  }

  @Get(":domainId")
  @GetDomainDocs()
  get(@Req() req: AuthedRequest, @Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.get(domainId, { id: req.user.id, isRoot: req.user.isRoot });
  }

  @Post()
  @CreateDomainDocs()
  @UseGuards(IsRootGuard)
  create(@Body(new ZodValidationPipe(createDomainSchema)) body: CreateDomainDto) {
    return this.svc.create(body);
  }

  @Patch(":domainId")
  @UpdateDomainDocs()
  @UseGuards(IsRootGuard)
  update(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(updateDomainSchema)) body: UpdateDomainDto
  ) {
    return this.svc.update(domainId, body);
  }

  @Delete(":domainId")
  @RemoveDomainDocs()
  @UseGuards(IsRootGuard)
  remove(@Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.remove(domainId);
  }
}
