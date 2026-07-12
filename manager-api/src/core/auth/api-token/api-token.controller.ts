import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { GlobalPermissionGuard } from "../../custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../custom-permission-guard/require-permissions.decorator";
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

type AuthedRequest = Request & { user: { id: string; email: string; isRoot: boolean } };

// Every route is already scoped to the caller's own tokens (`req.user.id` is
// passed to the service, never a target account), so these actions answer
// "may this account manage API tokens at all", not "whose tokens". Previously
// ungated entirely, which meant the `api-tokens` resource existed in the
// catalog and guarded nothing. Root bypasses all of it.
@Auth("JWT", "ApiToken")
@ApiTokensApi()
@Controller({ path: "api-tokens", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class ApiTokenController {
  constructor(private readonly svc: ApiTokenService) {}

  @Post()
  @RequireGlobalPermissions([{ resource: "api-tokens", actions: ["access", "create-api-token"] }])
  @CreateApiTokenDocs()
  create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(createApiTokenSchema)) body: CreateApiTokenDto) {
    return this.svc.create(req.user.id, body);
  }

  @Get()
  @RequireGlobalPermissions([{ resource: "api-tokens", actions: ["access", "list-api-tokens"] }])
  @ListApiTokensDocs()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.user.id);
  }

  @Patch(":id")
  @RequireGlobalPermissions([{ resource: "api-tokens", actions: ["access", "edit-api-token"] }])
  @UpdateApiTokenDocs()
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateApiTokenSchema)) body: UpdateApiTokenDto
  ) {
    return this.svc.update(req.user.id, id, body);
  }

  // Revoking leaves the row (and its audit trail) in place; deleting removes it.
  // Regenerating mints a new secret for the same row. Three different acts.
  @Post(":id/revoke")
  @RequireGlobalPermissions([{ resource: "api-tokens", actions: ["access", "revoke-api-token"] }])
  @HttpCode(200)
  @RevokeApiTokenDocs()
  revoke(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.revoke(req.user.id, id);
  }

  @Post(":id/regenerate")
  @RequireGlobalPermissions([{ resource: "api-tokens", actions: ["access", "regenerate-api-token"] }])
  @RegenerateApiTokenDocs()
  regenerate(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.regenerate(req.user.id, id);
  }

  @Delete(":id")
  @RequireGlobalPermissions([{ resource: "api-tokens", actions: ["access", "delete-api-token"] }])
  @DeleteApiTokenDocs()
  delete(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.delete(req.user.id, id);
  }
}
