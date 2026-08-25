import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { CreateAliasDto, createAliasSchema } from "../domains/aliases/aliases.validation";
import { CreateRecipientDto, createRecipientSchema } from "../domains/recipients/recipients.validation";
import {
  CreateMyAliasDocs,
  CreateMyRecipientDocs,
  DeleteMyAliasDocs,
  DeleteMyRecipientDocs,
  GetMyAliasDocs,
  GetMyRecipientDocs,
  ListMyDelegationsDocs,
  MySpaceApi,
  UpdateMyAliasDocs,
  UpdateMyRecipientDocs,
} from "./my-space.openapi";
import { MySpaceService } from "./my-space.service";
import { UpdateMyAliasDto, UpdateMyRecipientDto, updateMyAliasSchema, updateMyRecipientSchema } from "./my-space.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

// No permission guard: every route is scoped to the caller by ownership, checked
// in MySpaceService. Authentication is the app-wide CombinedAuthGuard.
@MySpaceApi()
@Controller({ path: "my-space", version: "1" })
export class MySpaceController {
  constructor(private readonly svc: MySpaceService) {}

  @Get("delegations")
  @ListMyDelegationsDocs()
  myDelegations(@Req() req: AuthedRequest) {
    return this.svc.myDelegations(req.user.id);
  }

  @Post("domains/:domainId/recipients")
  @CreateMyRecipientDocs()
  createRecipient(
    @Req() req: AuthedRequest,
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(createRecipientSchema)) body: CreateRecipientDto
  ) {
    return this.svc.createRecipient(req.user.id, domainId, body);
  }

  @Post("domains/:domainId/aliases")
  @CreateMyAliasDocs()
  createAlias(
    @Req() req: AuthedRequest,
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(createAliasSchema)) body: CreateAliasDto
  ) {
    return this.svc.createAlias(req.user.id, domainId, body);
  }

  @Get("recipients/:id")
  @GetMyRecipientDocs()
  getRecipient(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.getRecipient(req.user.id, id);
  }

  @Patch("recipients/:id")
  @UpdateMyRecipientDocs()
  updateRecipient(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateMyRecipientSchema)) body: UpdateMyRecipientDto
  ) {
    return this.svc.updateRecipient(req.user.id, id, body);
  }

  @Delete("recipients/:id")
  @DeleteMyRecipientDocs()
  deleteRecipient(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.deleteRecipient(req.user.id, id);
  }

  @Get("aliases/:id")
  @GetMyAliasDocs()
  getAlias(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.getAlias(req.user.id, id);
  }

  @Patch("aliases/:id")
  @UpdateMyAliasDocs()
  updateAlias(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateMyAliasSchema)) body: UpdateMyAliasDto
  ) {
    return this.svc.updateAlias(req.user.id, id, body);
  }

  @Delete("aliases/:id")
  @DeleteMyAliasDocs()
  deleteAlias(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.deleteAlias(req.user.id, id);
  }
}
