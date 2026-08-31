import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery } from "../../core/common/pagination.openapi";
import { TICKET_SORTABLE_COLUMNS } from "./tickets.service";

export const TicketsApi = () => applyDecorators(ApiTags("tickets"), ApiSecurity("apiToken"));

const idParam = () => ApiParam({ name: "id", type: Number, example: 1, description: "Ticket id" });

export const ListTicketsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(TICKET_SORTABLE_COLUMNS),
    ApiOperation({
      summary: "List support tickets the caller may see, across every domain",
      description:
        "`mine=true` keeps only the tickets the caller took in charge; `hideClosed=true` drops the closed ones. " +
        "Anything other than the literal `true` means no narrowing.",
    })
  );

export const CreateTicketDocs = () => applyDecorators(ApiOperation({ summary: "Open a support ticket about a domain" }));

export const TicketableDomainsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List the domains the caller may open a ticket about (permission, ownership or any foothold)" })
  );

export const TicketableResourcesDocs = () =>
  applyDecorators(
    ApiParam({ name: "domainId", type: Number, example: 1, description: "Domain the ticket is about" }),
    ApiOperation({
      summary: "List the mailboxes and aliases of a domain a ticket may name, and whether naming one is mandatory",
      description:
        "Never an address the caller has no claim on. Root and the domain's owner get every address of the domain; " +
        "anyone else gets the whole list of a kind only with the domain right that lists it " +
        "(`recipients:list-recipients`, `aliases:list-aliases`), and otherwise only the addresses they own there. " +
        "The two kinds are scoped separately. `required` mirrors the server setting behind `GET /config/tickets`, so " +
        "the creation form gates its submit on the same rule the API enforces.",
    })
  );

export const GetTicketDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Read a ticket and its message thread" }));

export const ListTicketMessagesDocs = () =>
  applyDecorators(
    idParam(),
    ApiPaginationQuery(["createdAt"]),
    ApiOperation({ summary: "Read a page of a ticket's message thread, newest first" })
  );

export const ReplyTicketDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Post a message on a ticket" }));

export const EditMessageDocs = () =>
  applyDecorators(idParam(), ApiOperation({ summary: "Edit one's own message, allowed only within an hour of writing it" }));

export const MarkTicketReadDocs = () =>
  applyDecorators(idParam(), ApiOperation({ summary: "Mark the thread read up to its newest message for the caller" }));

export const TakeTicketDocs = () =>
  applyDecorators(idParam(), ApiOperation({ summary: "Take charge of a ticket, refused on a ticket the caller opened" }));

export const UpdateTicketStatusDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Change a ticket's status" }));
