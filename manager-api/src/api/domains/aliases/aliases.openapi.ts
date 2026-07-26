import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../../core/common/pagination.openapi";
import { ALIASES_SORTABLE_COLUMNS } from "./aliases.service";

export const AliasesApi = () =>
  applyDecorators(
    ApiTags("domain-aliases"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

const aliasListItemExample = {
  id: 1,
  ownerId: null,
  domain: "example.com",
  source: "sales@example.com",
  destination: "jdoe@example.com",
  userStartDate: "2026-01-01",
  userEndDate: null,
  lastActivity: "2026-07-01T12:00:00.000Z",
};

export const ListAliasesDocs = () =>
  applyDecorators(
    ApiPaginationQuery(ALIASES_SORTABLE_COLUMNS),
    ApiOperation({ summary: "List aliases that belong to this domain, paginated" }),
    ApiResponse({
      status: 200,
      description: "Aliases returned",
      schema: { example: paginatedExample(aliasListItemExample) },
    }),
    ApiResponse({
      status: 400,
      description: "domainId is not a valid integer, or invalid pagination query",
      schema: {
        example: { statusCode: 400, message: "Validation failed (numeric string is expected)", error: "Bad Request" },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission aliases:access or aliases:list-aliases for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );

export const GetAliasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Fetch an alias by id (must belong to this domain)",
    }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_aliases.id" }),
    ApiResponse({
      status: 200,
      description: "Alias returned",
      schema: {
        example: {
          id: 1,
          ownerId: null,
          domain: "example.com",
          source: "sales@example.com",
          destination: "jdoe@example.com",
          userStartDate: "2026-01-01",
          userEndDate: null,
          lastActivity: "2026-07-01T12:00:00.000Z",
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "domainId or id is not a valid integer",
      schema: {
        example: { statusCode: 400, message: "Validation failed (numeric string is expected)", error: "Bad Request" },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission aliases:access or aliases:view-alias for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found, or alias not found in this domain",
      schema: { example: { statusCode: 404, message: "Alias #1 not found in example.com" } },
    })
  );

export const CreateAliasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a source -> destination alias under this domain; body carries the local-part and the destination",
      description: "The final source address is composed as `${localPart}@${domain}`.",
    }),
    ApiBody({
      schema: {
        example: {
          localPart: "sales",
          destination: "jdoe@example.com",
          userEndDate: null,
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: "Alias created",
      schema: {
        example: {
          id: 1,
          ownerId: null,
          domain: "example.com",
          source: "sales@example.com",
          destination: "jdoe@example.com",
          userStartDate: "2026-07-04",
          userEndDate: null,
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "Body validation failed, or domainId is not a valid integer",
      schema: { example: { message: "Validation failed", issues: [] } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission aliases:access or aliases:create-alias for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    }),
    ApiResponse({
      status: 409,
      description: "Alias source already exists",
      schema: { example: { statusCode: 409, message: "Alias sales@example.com already exists" } },
    })
  );

export const UpdateAliasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update local-part / destination / end-date of an alias in this domain",
      description:
        "`localPart` renames the alias within its own domain: the source is recomposed as `${localPart}@${domain}` " +
        "from the route's domain, never from the body, and the local-part may not contain an `@`.",
    }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_aliases.id" }),
    ApiBody({
      schema: {
        example: {
          localPart: "sales",
          destination: "jdoe@example.com",
          userEndDate: null,
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Alias updated",
      schema: {
        example: {
          id: 1,
          ownerId: null,
          domain: "example.com",
          source: "sales@example.com",
          destination: "jdoe@example.com",
          userStartDate: "2026-01-01",
          userEndDate: null,
          lastActivity: "2026-07-04T12:00:00.000Z",
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "Body validation failed, or domainId/id is not a valid integer",
      schema: { example: { message: "Validation failed", issues: [] } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission aliases:access or aliases:edit-alias for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found, or alias not found in this domain",
      schema: { example: { statusCode: 404, message: "Alias #1 not found in example.com" } },
    }),
    ApiResponse({
      status: 409,
      description: "Another alias of this domain already uses that local-part",
      schema: {
        example: {
          statusCode: 409,
          code: "aliases.alreadyExists",
          params: { source: "sales@example.com" },
          message: "Alias sales@example.com already exists",
        },
      },
    })
  );

export const AssignAliasOwnerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Assign this alias to an account (set its owner)",
      description:
        "An alias belongs to at most one account. Assigning one already owned returns 409; it must be released " +
        "first. postmaster@<domain> can never be owned (403).",
    }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_aliases.id" }),
    ApiBody({ schema: { example: { ownerId: "3f1c2b8e-0000-4a00-9000-000000000000" } } }),
    ApiResponse({ status: 200, description: "Owner assigned" }),
    ApiResponse({
      status: 403,
      description: "Missing permission mailboxes:assign-alias-owner, or target is postmaster@<domain>",
    }),
    ApiResponse({ status: 404, description: "Parent domain, alias, or target account not found" }),
    ApiResponse({ status: 409, description: "Alias already assigned to an account" })
  );

export const UnassignAliasOwnerDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Release this alias's owner (set it back to empty)" }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_aliases.id" }),
    ApiResponse({ status: 200, description: "Owner released" }),
    ApiResponse({ status: 403, description: "Missing permission mailboxes:unassign-alias-owner" }),
    ApiResponse({ status: 404, description: "Parent domain or alias not found" })
  );

export const RemoveAliasDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Delete an alias from this domain" }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_aliases.id" }),
    ApiResponse({
      status: 200,
      description: "Alias deleted",
      schema: { example: { ok: true } },
    }),
    ApiResponse({
      status: 400,
      description: "domainId or id is not a valid integer",
      schema: {
        example: { statusCode: 400, message: "Validation failed (numeric string is expected)", error: "Bad Request" },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission aliases:access or aliases:delete-alias for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found, or alias not found in this domain",
      schema: { example: { statusCode: 404, message: "Alias #1 not found in example.com" } },
    })
  );
