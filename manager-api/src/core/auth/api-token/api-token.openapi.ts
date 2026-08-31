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

export const RevealApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "API token id" }),
    ApiOperation({
      summary: "Read the full key of an API token back, as many times as asked",
      description:
        "Self-scoped to the authenticated account (req.user.id): a token id belonging to another account is " +
        "indistinguishable from a nonexistent one and returns 404, never 403. Handing back a working credential " +
        "weighs the same as minting one, so it is gated on `regenerate-api-token` rather than on the listing " +
        "actions. The secret is stored twice: an HMAC digest, which is what authentication compares, and an " +
        "AES-256-GCM ciphertext sealed with MANAGER_API_TOKEN_PEPPER, which is what this route opens. `key` is " +
        "null, with no error, when there is nothing to give back: a token minted before the ciphertext column " +
        "existed, or one sealed under a pepper that has since been rotated. The answer is served with " +
        "Cache-Control: no-store.",
    }),
    ApiResponse({
      status: 200,
      description: "The full key, or null when it cannot be read back",
      schema: {
        example: {
          id: 7,
          name: "CI deploy key",
          clientId: "Zm9vYmFyMTIzNDU2Nzg5MA",
          key: "sms_Zm9vYmFyMTIzNDU2Nzg5MA.c29tZS1yYW5kb20tc2VjcmV0LXZhbHVl",
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    }),
    ApiResponse({
      status: 404,
      description: "No such token for this account",
      schema: { example: notFoundExample },
    })
  );

const accessEntryExample = {
  id: "5821",
  tokenId: 7,
  method: "GET",
  route: "/api/v1/domains?limit=10&offset=0",
  statusCode: 200,
  clientIp: "203.0.113.10",
  userAgent: "python-requests/2.32.3",
  origin: "",
  referer: "",
  durationMs: 42,
  createdAt: "2026-08-25T09:12:44.000Z",
};

export const ListApiTokenAccessDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "API token id" }),
    ApiOperation({
      summary: "Access trail of one API token: every request sent with it, refusals included",
      description:
        "Self-scoped to the authenticated account (req.user.id): a token id belonging to another account is " +
        "indistinguishable from a nonexistent one and returns 404, never 403. One row per request that carried " +
        "this token's key, whatever the answer was, so a rejected key (revoked, expired, IP not allowed, wrong " +
        "secret) shows up here with its 401. Paginated with limit/offset/search/sortBy/sortDir; sortable columns " +
        "are createdAt, method, route, statusCode, clientIp and durationMs. Rows older than " +
        "MANAGER_API_TOKEN_ACCESS_RETENTION_DAYS (90 by default) are swept away.",
    }),
    ApiResponse({
      status: 200,
      description: "One page of the trail, newest first by default",
      schema: { example: { items: [accessEntryExample], total: 4927 } },
    }),
    ApiResponse({
      status: 401,
      description: "Not authenticated",
      schema: { example: unauthorizedExample },
    }),
    ApiResponse({
      status: 404,
      description: "No such token for this account",
      schema: { example: notFoundExample },
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
