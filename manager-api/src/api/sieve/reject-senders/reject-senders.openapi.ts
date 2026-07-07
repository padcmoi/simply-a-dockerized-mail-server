import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../../core/common/pagination.openapi";

export const RejectSendersApi = () => applyDecorators(ApiTags("sieve"), ApiSecurity("apiToken"));

const rejectSenderExample = {
  id: 1,
  sender: "spam@baddomain.example",
  enabled: 1,
  createdAt: "2026-07-04T12:00:00.000Z",
  updatedAt: "2026-07-04T12:00:00.000Z",
};

const ForbiddenSieveResponse = (action: "read" | "create" | "modify" | "delete") =>
  ApiResponse({
    status: 403,
    description: `Missing the \`sieve:access\` and/or \`sieve:${action}\` global permission (the message names whichever is missing first)`,
    schema: {
      example: { statusCode: 403, message: "Missing permission sieve:access", error: "Forbidden" },
    },
  });

const ValidationBadRequestResponse = () =>
  ApiResponse({
    status: 400,
    description: "Body failed Zod validation",
    schema: {
      example: {
        message: "Validation failed",
        issues: [
          {
            code: "too_small",
            minimum: 2,
            type: "string",
            inclusive: true,
            message: "String must contain at least 2 character(s)",
            path: ["sender"],
          },
        ],
      },
    },
  });

const NotFoundRejectSenderResponse = () =>
  ApiResponse({
    status: 404,
    description: "No blacklist entry exists with this id",
    schema: {
      example: { statusCode: 404, message: "Not Found" },
    },
  });

export const ListRejectSendersDocs = () =>
  applyDecorators(
    ApiPaginationQuery(),
    ApiOperation({
      summary: "List entries on the postfix SMTP-time sender blacklist, paginated",
    }),
    ApiResponse({
      status: 200,
      description: "Blacklist entries",
      schema: { example: paginatedExample(rejectSenderExample) },
    }),
    ApiResponse({ status: 400, description: "Invalid pagination query (e.g. limit not 10/25/50)" }),
    ForbiddenSieveResponse("read")
  );

export const CreateRejectSenderDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Add a sender (email or `@domain`) to the SMTP-time blacklist",
      description: "New entries are created enabled by default. `sender` must be 2-255 characters long.",
    }),
    ApiBody({
      description: "Sender address or `@domain` to block",
      schema: {
        example: { sender: "spam@baddomain.example" },
      },
    }),
    ApiResponse({
      status: 201,
      description: "Blacklist entry created",
      schema: { example: rejectSenderExample },
    }),
    ValidationBadRequestResponse(),
    ForbiddenSieveResponse("create"),
    ApiResponse({
      status: 409,
      description: "This sender is already on the blacklist",
      schema: {
        example: {
          statusCode: 409,
          message: "Sender spam@baddomain.example already blocked",
          error: "Conflict",
        },
      },
    })
  );

export const ToggleRejectSenderDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Enable / disable a blacklist entry without deleting it",
    }),
    ApiParam({ name: "id", type: Number, example: 1, description: "Blacklist entry id" }),
    ApiBody({
      description: "New enabled state",
      schema: { example: { enabled: false } },
    }),
    ApiResponse({
      status: 200,
      description: "Blacklist entry updated",
      schema: { example: { ...rejectSenderExample, enabled: 0 } },
    }),
    ValidationBadRequestResponse(),
    ForbiddenSieveResponse("modify"),
    NotFoundRejectSenderResponse()
  );

export const RemoveRejectSenderDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Delete a blacklist entry" }),
    ApiParam({ name: "id", type: Number, example: 1, description: "Blacklist entry id" }),
    ApiResponse({
      status: 200,
      description: "Blacklist entry deleted",
      schema: { example: { ok: true } },
    }),
    ForbiddenSieveResponse("delete"),
    NotFoundRejectSenderResponse()
  );
