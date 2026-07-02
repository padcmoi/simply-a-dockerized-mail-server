import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { Auth } from "../auth.decorator";
import {
  ApiTokensApi,
  CreateApiTokenDocs,
  DeleteApiTokenDocs,
  ListApiTokensDocs,
  RegenerateApiTokenDocs,
  RevokeApiTokenDocs,
  UpdateApiTokenDocs,
} from "./api-token.openapi";
import { ApiTokenService } from "./api-token.service";
import { CreateApiTokenDto, UpdateApiTokenDto, createApiTokenSchema, updateApiTokenSchema } from "./api-token.validation";

type AuthedRequest = Request & { user: { id: number; username: string; isRoot: boolean } };

@Auth("JWT", "ApiToken")
@ApiTokensApi()
@Controller({ path: "api-tokens", version: "1" })
export class ApiTokenController {
  constructor(private readonly svc: ApiTokenService) {}

  @Post()
  @CreateApiTokenDocs()
  create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(createApiTokenSchema)) body: CreateApiTokenDto) {
    return this.svc.create(req.user.id, body);
  }

  @Get()
  @ListApiTokensDocs()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.user.id);
  }

  @Patch(":id")
  @UpdateApiTokenDocs()
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateApiTokenSchema)) body: UpdateApiTokenDto
  ) {
    return this.svc.update(req.user.id, id, body);
  }

  @Post(":id/revoke")
  @RevokeApiTokenDocs()
  revoke(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.revoke(req.user.id, id);
  }

  @Post(":id/regenerate")
  @RegenerateApiTokenDocs()
  regenerate(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.regenerate(req.user.id, id);
  }

  @Delete(":id")
  @DeleteApiTokenDocs()
  delete(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.delete(req.user.id, id);
  }
}
