import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import {
  CreateTicketDocs,
  TicketableDomainsDocs,
  EditMessageDocs,
  GetTicketDocs,
  ListTicketMessagesDocs,
  MarkTicketReadDocs,
  ListTicketsDocs,
  ReplyTicketDocs,
  TakeTicketDocs,
  TicketsApi,
  UpdateTicketStatusDocs,
} from "./tickets.openapi";
import { TicketCaller, TicketsService } from "./tickets.service";
import {
  CreateTicketDto,
  EditMessageDto,
  ReplyTicketDto,
  TicketListQuery,
  UpdateStatusDto,
  createTicketSchema,
  editMessageSchema,
  ticketListQuerySchema,
  replyTicketSchema,
  updateStatusSchema,
} from "./tickets.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

function caller(req: AuthedRequest): TicketCaller {
  return { userId: req.user.id, isRoot: req.user.isRoot };
}

@TicketsApi()
@Controller({ path: "tickets", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class TicketsController {
  constructor(private readonly svc: TicketsService) {}

  @Get()
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "list-tickets"] }])
  @ListTicketsDocs()
  list(@Req() req: AuthedRequest, @Query(new ZodValidationPipe(ticketListQuerySchema)) query: TicketListQuery) {
    return this.svc.list(query, caller(req));
  }

  @Post()
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "create-ticket"] }])
  @CreateTicketDocs()
  create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(createTicketSchema)) body: CreateTicketDto) {
    return this.svc.create(body, caller(req));
  }

  // Declared before ":id" so "tickets/domains" is not captured by the int pipe.
  @Get("domains")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "create-ticket"] }])
  @TicketableDomainsDocs()
  ticketableDomains(@Req() req: AuthedRequest) {
    return this.svc.ticketableDomains(caller(req));
  }

  @Get(":id")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "view-ticket"] }])
  @GetTicketDocs()
  get(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.get(id, caller(req));
  }

  @Get(":id/messages")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "view-ticket"] }])
  @ListTicketMessagesDocs()
  messages(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    return this.svc.messagesPage(id, caller(req), query);
  }

  // Only `view-ticket` here: the author replies to their own ticket without any
  // extra action, and TicketsService requires `reply-ticket` for the others.
  @Post(":id/messages")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "view-ticket"] }])
  @ReplyTicketDocs()
  reply(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(replyTicketSchema)) body: ReplyTicketDto
  ) {
    return this.svc.reply(id, body, caller(req));
  }

  // Only `view-ticket`: TicketsService restricts the edit to the message's own
  // author and to the one-hour window.
  @Patch(":id/messages/:messageId")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "view-ticket"] }])
  @EditMessageDocs()
  editMessage(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Param("messageId", ParseIntPipe) messageId: number,
    @Body(new ZodValidationPipe(editMessageSchema)) body: EditMessageDto
  ) {
    return this.svc.editMessage(id, messageId, body.body, caller(req));
  }

  @Post(":id/read")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "view-ticket"] }])
  @MarkTicketReadDocs()
  markRead(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.markRead(id, caller(req));
  }

  @Post(":id/take")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "handle-ticket"] }])
  @TakeTicketDocs()
  take(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.take(id, caller(req));
  }

  // Only `view-ticket` here: the author may close their own ticket without the
  // support role, and TicketsService requires `handle-ticket` for anything else.
  @Patch(":id/status")
  @RequireGlobalPermissions([{ resource: "tickets", actions: ["access", "view-ticket"] }])
  @UpdateTicketStatusDocs()
  updateStatus(
    @Req() req: AuthedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateStatusSchema)) body: UpdateStatusDto
  ) {
    return this.svc.setStatus(id, body.status, caller(req));
  }
}
