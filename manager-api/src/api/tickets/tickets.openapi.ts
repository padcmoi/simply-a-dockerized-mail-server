import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery } from "../../core/common/pagination.openapi";
import { TICKET_SORTABLE_COLUMNS } from "./tickets.service";

export const TicketsApi = () => applyDecorators(ApiTags("tickets"), ApiSecurity("apiToken"));

const idParam = () => ApiParam({ name: "id", type: Number, example: 1, description: "Ticket id" });

export const ListTicketsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(TICKET_SORTABLE_COLUMNS),
    ApiOperation({ summary: "List support tickets the caller may see, across every domain" })
  );

export const CreateTicketDocs = () => applyDecorators(ApiOperation({ summary: "Open a support ticket about a domain" }));

export const GetTicketDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Read a ticket and its message thread" }));

export const ListTicketMessagesDocs = () =>
  applyDecorators(
    idParam(),
    ApiPaginationQuery(["createdAt"]),
    ApiOperation({ summary: "Read a page of a ticket's message thread, newest first" })
  );

export const ReplyTicketDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Post a message on a ticket" }));

export const TakeTicketDocs = () =>
  applyDecorators(idParam(), ApiOperation({ summary: "Take charge of a ticket, refused on a ticket the caller opened" }));

export const UpdateTicketStatusDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Change a ticket's status" }));
