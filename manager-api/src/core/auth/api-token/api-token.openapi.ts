import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const ApiTokensApi = () => applyDecorators(ApiTags("api-tokens"), ApiSecurity("apiToken"));

export const CreateApiTokenDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Create a new API token — the secret is returned once and never stored in plain text" }),
    ApiResponse({ status: 201, description: "Token created; copy the key field immediately" }),
    ApiResponse({ status: 401, description: "Not authenticated" })
  );

export const ListApiTokensDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List all API tokens for the authenticated account (secrets never exposed)" }),
    ApiResponse({ status: 200, description: "Token list" })
  );

export const UpdateApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number }),
    ApiOperation({ summary: "Update name, allowed IPs or expiry of an API token" }),
    ApiResponse({ status: 200, description: "Updated token metadata" }),
    ApiResponse({ status: 404, description: "Token not found" })
  );

export const RevokeApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number }),
    ApiOperation({ summary: "Soft-revoke an API token — disables it without deleting" }),
    ApiResponse({ status: 201, description: "Token revoked; it remains visible but is no longer valid" }),
    ApiResponse({ status: 400, description: "Already revoked" }),
    ApiResponse({ status: 404, description: "Token not found" })
  );

export const RegenerateApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number }),
    ApiOperation({ summary: "Regenerate the secret of an active token — old secret is immediately invalid" }),
    ApiResponse({ status: 201, description: "New key returned once; copy immediately" }),
    ApiResponse({ status: 400, description: "Token is revoked" }),
    ApiResponse({ status: 404, description: "Token not found" })
  );

export const DeleteApiTokenDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number }),
    ApiOperation({ summary: "Permanently delete a revoked token" }),
    ApiResponse({ status: 200, description: "Token deleted" }),
    ApiResponse({ status: 400, description: "Token must be revoked before deletion" }),
    ApiResponse({ status: 404, description: "Token not found" })
  );
