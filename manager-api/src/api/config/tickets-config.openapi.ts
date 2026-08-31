import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const TicketsConfigApi = () => applyDecorators(ApiTags("config"));

const example = { ticketResourcesRequired: true };

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetTicketsConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read whether opening a ticket must name a mailbox or an alias",
      description:
        "When on, `POST /tickets` refuses a ticket that names neither a recipient nor an alias of its domain. The " +
        "creation form reads the same flag through `GET /tickets/domains/:domainId/resources`, which every account " +
        "allowed to open a ticket may call; this route is the root-only side that changes it.",
    }),
    ApiResponse({ status: 200, schema: { example } }),
    RootOnly()
  );

export const UpdateTicketsConfigDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Turn the mandatory mailbox/alias on a new ticket on or off" }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({
      status: 400,
      description: "Not a boolean",
      schema: { example: { statusCode: 400, message: "Validation failed", error: "Bad Request" } },
    }),
    RootOnly()
  );
