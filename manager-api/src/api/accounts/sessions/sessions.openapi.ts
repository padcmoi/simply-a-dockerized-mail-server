import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../../core/common/pagination.openapi";
import { SESSIONS_SEARCHABLE_COLUMNS, SESSIONS_SORTABLE_COLUMNS } from "../../../core/auth/jwt/jwt.service";

const sessionExample = {
  id: 42,
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/126",
  ip: "203.0.113.7",
  createdAt: "2026-07-14T09:00:00.000Z",
  expiresAt: "2026-08-13T09:00:00.000Z",
  revokedAt: null,
  lastSeenAt: "2026-07-14T09:31:00.000Z",
  active: true,
  online: true,
};

const sessionsOverviewExample = {
  accountId: "16d23d22-0000-0000-0000-000000000000",
  email: "jdoe@example.com",
  displayName: "John Doe",
  activeCount: 3,
  expiredCount: 12,
  online: true,
  lastSeenAt: "2026-07-14T09:31:00.000Z",
  expiredLastSeenAt: "2026-07-13T21:04:00.000Z",
};

export const SessionsOverviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        "Per-account session summary across every account, active + expired counts and online state (accounts:view-account-sessions)",
    }),
    ApiResponse({ status: 200, description: "Session overview returned", schema: { example: [sessionsOverviewExample] } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing accounts:view-account-sessions" })
  );

export const AccountActiveSessionsDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: String, description: "accounts.id (uuid)" }),
    ApiOperation({ summary: "One account's active sessions, one per device (accounts:view-account-sessions)" }),
    ApiResponse({ status: 200, description: "Active sessions returned", schema: { example: [sessionExample] } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing accounts:view-account-sessions" })
  );

export const AccountSessionHistoryDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: String, description: "accounts.id (uuid)" }),
    ApiPaginationQuery(SESSIONS_SORTABLE_COLUMNS, SESSIONS_SEARCHABLE_COLUMNS),
    ApiOperation({
      summary: "One account's expired or revoked sessions, paginated + searchable (accounts:view-account-sessions)",
    }),
    ApiResponse({
      status: 200,
      description: "Session history returned",
      schema: {
        example: paginatedExample({ ...sessionExample, active: false, online: false, revokedAt: "2026-07-14T09:20:00.000Z" }),
      },
    }),
    ApiResponse({ status: 400, description: "Invalid pagination query" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing accounts:view-account-sessions" })
  );

export const RevokeAccountSessionDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: String, description: "accounts.id (uuid)" }),
    ApiParam({ name: "sessionId", type: Number, description: "refresh_tokens.id of the session to revoke" }),
    ApiOperation({
      summary: "Revoke one session of an account, signing that device out on its next request (accounts:revoke-account-sessions)",
    }),
    ApiResponse({ status: 200, description: "Session revoked", schema: { example: { ok: true } } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing accounts:revoke-account-sessions" }),
    ApiResponse({ status: 404, description: "No such session for this account" })
  );

export const RevokeAllAccountSessionsDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: String, description: "accounts.id (uuid)" }),
    ApiOperation({ summary: "Revoke every active session of an account at once (accounts:revoke-account-sessions)" }),
    ApiResponse({ status: 200, description: "Sessions revoked", schema: { example: { ok: true, revoked: 3 } } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing accounts:revoke-account-sessions" })
  );

export const PurgeAccountSessionsDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: String, description: "accounts.id (uuid)" }),
    ApiOperation({
      summary: "Permanently delete every expired or revoked session of an account (accounts:purge-account-sessions)",
      description: "Clears the account's session history in one call. Live sessions are untouched; nobody is signed out.",
    }),
    ApiResponse({ status: 200, description: "History purged", schema: { example: { ok: true, purged: 42 } } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing accounts:purge-account-sessions" })
  );
