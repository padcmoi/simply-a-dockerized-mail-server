import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const RecipientsApi = () =>
  applyDecorators(
    ApiTags("domain-recipients"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

export const ListRecipientsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List recipients that belong to this domain" }),
    ApiResponse({
      status: 200,
      description: "Recipients returned",
      schema: {
        example: [
          {
            id: 1,
            ownerId: null,
            domain: "example.com",
            email: "jdoe@example.com",
            maildir: "example.com/jdoe/",
            quota: "104857600",
            active: 1,
            uid: "vmail",
            gid: "vmail",
            userStartDate: "2026-01-01",
            userEndDate: null,
            lastActivity: "2026-07-01T12:00:00.000Z",
          },
        ],
      },
    }),
    ApiResponse({
      status: 400,
      description: "domainId is not a valid integer",
      schema: {
        example: { statusCode: 400, message: "Validation failed (numeric string is expected)", error: "Bad Request" },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission recipients:access or recipients:read for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );

export const GetRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Fetch a recipient by id (must belong to this domain)",
    }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_users.id" }),
    ApiResponse({
      status: 200,
      description: "Recipient returned",
      schema: {
        example: {
          id: 1,
          ownerId: null,
          domain: "example.com",
          email: "jdoe@example.com",
          maildir: "example.com/jdoe/",
          quota: "104857600",
          active: 1,
          uid: "vmail",
          gid: "vmail",
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
      description: "Missing permission recipients:access or recipients:read for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found, or recipient not found in this domain",
      schema: { example: { statusCode: 404, message: "Recipient #1 not found in example.com" } },
    })
  );

export const CreateRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a recipient under this domain; body carries only the local-part",
      description: "The final address is composed as `${localPart}@${domain}`. `postmaster` is reserved and cannot be used.",
    }),
    ApiBody({
      schema: {
        example: {
          localPart: "jdoe",
          password: "correcthorsebattery",
          quota: 104857600,
          active: true,
          userEndDate: null,
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: "Recipient created",
      schema: {
        example: {
          id: 1,
          ownerId: null,
          domain: "example.com",
          email: "jdoe@example.com",
          maildir: "example.com/jdoe/",
          quota: "104857600",
          active: 1,
          uid: "vmail",
          gid: "vmail",
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
      description: "Missing permission recipients:access or recipients:create for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    }),
    ApiResponse({
      status: 409,
      description: "localPart is 'postmaster' (reserved), or the recipient email already exists",
      schema: { example: { statusCode: 409, message: "Recipient jdoe@example.com already exists" } },
    })
  );

export const UpdateRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update password / quota / active flag / end-date of a recipient in this domain",
      description: "postmaster@<domain> is managed automatically and cannot be modified through this route.",
    }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_users.id" }),
    ApiBody({
      schema: {
        example: {
          quota: 209715200,
          active: true,
          userEndDate: null,
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Recipient updated",
      schema: {
        example: {
          id: 1,
          ownerId: null,
          domain: "example.com",
          email: "jdoe@example.com",
          maildir: "example.com/jdoe/",
          quota: "209715200",
          active: 1,
          uid: "vmail",
          gid: "vmail",
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
      description:
        "Missing permission recipients:access or recipients:modify for this domain, or target is postmaster@<domain> (which cannot be modified)",
      schema: { example: { statusCode: 403, message: "postmaster@ is managed automatically and cannot be modified" } },
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found, or recipient not found in this domain",
      schema: { example: { statusCode: 404, message: "Recipient #1 not found in example.com" } },
    })
  );

export const RemoveRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Permanently delete a recipient from this domain",
      description: "postmaster@<domain> is managed automatically and cannot be deleted through this route.",
    }),
    ApiParam({ name: "id", type: Number, example: 1, description: "virtual_users.id" }),
    ApiResponse({
      status: 200,
      description: "Recipient deleted",
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
      description:
        "Missing permission recipients:access or recipients:delete for this domain, or target is postmaster@<domain> (which cannot be deleted)",
      schema: { example: { statusCode: 403, message: "postmaster@ cannot be deleted" } },
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found, or recipient not found in this domain",
      schema: { example: { statusCode: 404, message: "Recipient #1 not found in example.com" } },
    })
  );
