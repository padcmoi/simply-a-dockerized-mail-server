import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import {
  DeleteMyAliasDocs,
  DeleteMyRecipientDocs,
  GetMyAliasDocs,
  GetMyRecipientDocs,
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
