import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import {
  CreateRejectSenderDocs,
  ListRejectSendersDocs,
  RejectSendersApi,
  RemoveRejectSenderDocs,
  ToggleRejectSenderDocs,
} from "./reject-senders.openapi";
import { RejectSendersService } from "./reject-senders.service";
import {
  CreateRejectSenderDto,
  ToggleRejectSenderDto,
  createRejectSenderSchema,
  toggleRejectSenderSchema,
} from "./reject-senders.validation";

@RejectSendersApi()
@Controller({ path: "sieve/reject-senders", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class RejectSendersController {
  constructor(private readonly svc: RejectSendersService) {}

  @Get()
  @RequireGlobalPermissions([{ resource: "sieve", actions: ["access", "list-reject-senders"] }])
  @ListRejectSendersDocs()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(query);
  }

  @Post()
  @RequireGlobalPermissions([{ resource: "sieve", actions: ["access", "create-reject-sender"] }])
  @CreateRejectSenderDocs()
  create(
    @Body(new ZodValidationPipe(createRejectSenderSchema))
    body: CreateRejectSenderDto
  ) {
    return this.svc.create(body.sender);
  }

  @Patch(":id")
  @RequireGlobalPermissions([{ resource: "sieve", actions: ["access", "edit-reject-sender"] }])
  @ToggleRejectSenderDocs()
  toggle(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(toggleRejectSenderSchema))
    body: ToggleRejectSenderDto
  ) {
    return this.svc.toggle(id, body.enabled);
  }

  @Delete(":id")
  @RequireGlobalPermissions([{ resource: "sieve", actions: ["access", "delete-reject-sender"] }])
  @RemoveRejectSenderDocs()
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
