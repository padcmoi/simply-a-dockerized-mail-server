import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
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
export class RejectSendersController {
  constructor(private readonly svc: RejectSendersService) {}

  @Get()
  @ListRejectSendersDocs()
  list() {
    return this.svc.list();
  }

  @Post()
  @CreateRejectSenderDocs()
  create(@Body(new ZodValidationPipe(createRejectSenderSchema)) body: CreateRejectSenderDto) {
    return this.svc.create(body.sender);
  }

  @Patch(":id")
  @ToggleRejectSenderDocs()
  toggle(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(toggleRejectSenderSchema)) body: ToggleRejectSenderDto
  ) {
    return this.svc.toggle(id, body.enabled);
  }

  @Delete(":id")
  @RemoveRejectSenderDocs()
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
