import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const ApiTokensApi = () => applyDecorators(ApiTags("api-tokens"), ApiSecurity("apiToken"));

const validationFailedExample = {
  message: "Validation failed",
  issues: [
    {
      code: "too_small",
      minimum: 1,
      type: "string",
      inclusive: true,
      path: ["name"],
      message: "String must contain at least 1 character(s)",
    },
  ],
};

const unauthorizedExample = { message: "Unauthorized", statusCode: 401 };

const notFoundExample = { message: "Token not found", error: "Not Found", statusCode: 404 };

const conflictExample = {
  message: "A token with this name already exists",
  error: "Conflict",
  statusCode: 409,
};

const safeTokenExample = {
  id: 7,
  name: "CI deploy key",
  clientId: "Zm9vYmFyMTIzNDU2Nzg5MA",
  allowedIps: ["203.0.113.10", "203.0.113.11"],
  expiresAt: "2026-12-31T23:59:59.000Z",
  revokedAt: null,
  lastUsedAt: null,
  lastUsedIp: null,
  createdAt: "2026-07-04T10:15:00.000Z",
};

const revealedKeyExample = {
  id: 7,
  name: "CI deploy key",
  clientId: "Zm9vYmFyMTIzNDU2Nzg5MA",
  key: "sms_Zm9vYmFyMTIzNDU2Nzg5MA.c29tZS1yYW5kb20tc2VjcmV0LXZhbHVl",
  allowedIps: ["203.0.113.10", "203.0.113.11"],
  expiresAt: "2026-12-31T23:59:59.000Z",
  createdAt: "2026-07-04T10:15:00.000Z",
};

export const CreateApiTokenDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a new API token: the secret is returned once and never stored in plain text",
      description:
        "Self-scoped to the authenticated account (req.user.id): the created token authenticates as its owner. " +
        "The full key (format `sms_clientId.secret`) is only ever present in this response's `key` field; only " +
        "an HMAC hash of the secret is persisted, so it cannot be retrieved again. Use /api-tokens/:id/regenerate " +
        "if it is lost. Send the key on later requests via the `X-Api-Key` header. Token names must be unique per " +
        "account.",
    }),
    ApiBody({
      schema: {
        example: {
          name: "CI deploy key",
          allowedIps: ["203.0.113.10", "203.0.113.11"],
          expiresAt: "2026-12-31T23:59:59.000Z",
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: "Token created; copy the `key` field immediately, it will never be shown again",
      schema: { example: revealedKeyExample },
    }),
    ApiResponse({
      status: 400,
      description: "Validation failed (empty/too long name, malformed IP, or malformed expiresAt)",
      schema: { example: validationFailedExample },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    }),
    ApiResponse({
      status: 409,
      description: "This account already has a token with the same name",
      schema: { example: conflictExample },
    })
  );

export const ListApiTokensDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List all API tokens for the authenticated account (secrets never exposed)",
      description: "Self-scoped to the authenticated account (req.user.id): only that account's own tokens are returned.",
    }),
    ApiResponse({
      status: 200,
      description: "Token list, most recently created first",
      schema: { example: [safeTokenExample] },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    })
  );

export const UpdateApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "API token id" }),
    ApiOperation({
      summary: "Update name, allowed IPs or expiry of an API token",
      description:
        "Self-scoped to the authenticated account (req.user.id): a token id belonging to another account is " +
        "indistinguishable from a nonexistent one and returns 404, never 403. Fields omitted from the body are " +
        "left unchanged; allowedIps/expiresAt set to null clear the restriction.",
    }),
    ApiBody({
      schema: {
        example: { name: "Backup script", allowedIps: null, expiresAt: null },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Updated token metadata",
      schema: { example: safeTokenExample },
    }),
    ApiResponse({
      status: 400,
      description: "Validation failed (empty/too long name, malformed IP, or malformed expiresAt)",
      schema: { example: validationFailedExample },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    }),
    ApiResponse({
      status: 404,
      description: "Token not found (or it belongs to a different account)",
      schema: { example: notFoundExample },
    }),
    ApiResponse({
      status: 409,
      description: "This account already has another token with the same name",
      schema: { example: conflictExample },
    })
  );

export const RevokeApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "API token id" }),
    ApiOperation({
      summary: "Soft-revoke an API token: disables it without deleting",
      description:
        "Self-scoped to the authenticated account (req.user.id): a token id belonging to another account " +
        "returns 404, never 403. The token remains visible via GET /api-tokens but can no longer authenticate " +
        "requests. Revoking an already-revoked token fails with 400 (not idempotent).",
    }),
    ApiResponse({
      status: 200,
      description: "Token revoked; it remains visible but is no longer valid",
      schema: { example: { ...safeTokenExample, revokedAt: "2026-07-04T10:20:00.000Z" } },
    }),
    ApiResponse({
      status: 400,
      description: "Token is already revoked",
      schema: { example: { message: "Token is already revoked", error: "Bad Request", statusCode: 400 } },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    }),
    ApiResponse({
      status: 404,
      description: "Token not found (or it belongs to a different account)",
      schema: { example: notFoundExample },
    })
  );

export const RegenerateApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "API token id" }),
    ApiOperation({
      summary: "Regenerate the secret of an active token: old secret is immediately invalid",
      description:
        "Self-scoped to the authenticated account (req.user.id): a token id belonging to another account " +
        "returns 404, never 403. The new key (format `sms_clientId.secret`) is only ever present in this " +
        "response's `key` field and is not retrievable afterwards. The clientId is unchanged; failed-attempt " +
        "lockout state is reset. Cannot be used on a revoked token.",
    }),
    ApiResponse({
      status: 201,
      description: "New key returned once; copy it immediately, it will never be shown again",
      schema: { example: revealedKeyExample },
    }),
    ApiResponse({
      status: 400,
      description: "Token is revoked",
      schema: { example: { message: "Cannot regenerate a revoked token", error: "Bad Request", statusCode: 400 } },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    }),
    ApiResponse({
      status: 404,
      description: "Token not found (or it belongs to a different account)",
      schema: { example: notFoundExample },
    })
  );

export const DeleteApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "API token id" }),
    ApiOperation({
      summary: "Permanently delete a revoked token",
      description:
        "Self-scoped to the authenticated account (req.user.id): a token id belonging to another account " +
        "returns 404, never 403. The token must already be revoked via /api-tokens/:id/revoke; deleting an " +
        "active token fails with 400. No response body is returned on success.",
    }),
    ApiResponse({
      status: 200,
      description: "Token deleted (no response body)",
    }),
    ApiResponse({
      status: 400,
      description: "Token must be revoked before deletion",
      schema: {
        example: { message: "Token must be revoked before deletion", error: "Bad Request", statusCode: 400 },
      },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    }),
    ApiResponse({
      status: 404,
      description: "Token not found (or it belongs to a different account)",
      schema: { example: notFoundExample },
    })
  );
