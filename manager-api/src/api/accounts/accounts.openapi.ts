import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../core/common/pagination.openapi";
import { ACCOUNTS_SORTABLE_COLUMNS } from "./accounts.service";

export const AccountsApi = () => applyDecorators(ApiTags("accounts"), ApiSecurity("apiToken"));

const accountNameExample = { id: 5, username: "jdoe", name: "John Doe" };

const accountListItemExample = {
  id: 5,
  username: "jdoe",
  name: "John Doe",
  email: "jdoe@example.com",
  isRoot: false,
  enabled: true,
  lastLogin: "2026-06-30T08:12:00.000Z",
  createdAt: "2026-01-10T09:00:00.000Z",
  groups: [{ id: 3, name: "Support Team" }],
};

export const ListAccountNamesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List every account's id, username and display name (any authenticated account)",
    }),
    ApiQuery({
      name: "notInGroup",
      required: false,
      type: String,
      description: "A group id: exclude accounts already members of it (returns only assignable accounts)",
    }),
    ApiQuery({
      name: "search",
      required: false,
      type: String,
      description: "Typeahead filter on username / display name (LIKE)",
    }),
    ApiQuery({
      name: "limit",
      required: false,
      type: Number,
      description: "Cap the number of matches (1-50); absent returns the full list",
    }),
    ApiResponse({ status: 200, description: "Account names returned", schema: { example: [accountNameExample] } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" })
  );

export const ListAccountsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(ACCOUNTS_SORTABLE_COLUMNS),
    ApiOperation({
      summary: "List all manager accounts with their groups, paginated (root only)",
    }),
    ApiResponse({
      status: 200,
      description: "Accounts returned",
      schema: { example: paginatedExample(accountListItemExample) },
    }),
    ApiResponse({ status: 400, description: "Invalid pagination query (e.g. limit not 10/25/50)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Root access required" })
  );

const accountDetailExample = { ...accountListItemExample, avatarUrl: "https://example.com/avatar.png" };

export const GetAccountDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "accounts.id" }),
    ApiOperation({ summary: "Get a single manager account by id, with its groups (root only)" }),
    ApiResponse({ status: 200, description: "Account returned", schema: { example: accountDetailExample } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Root access required" }),
    ApiResponse({ status: 404, description: "Account not found" })
  );

export const UpdateAccountDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "accounts.id" }),
    ApiOperation({
      summary: "Update a manager account's profile fields and enabled status (root only)",
      description: "Group membership is managed separately via the groups endpoints, not through this route.",
    }),
    ApiBody({ schema: { example: { name: "John Doe", email: "jdoe@example.com", enabled: true } } }),
    ApiResponse({ status: 200, description: "Account updated", schema: { example: accountDetailExample } }),
    ApiResponse({ status: 400, description: "Invalid body, or attempting to disable a root account" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Root access required" }),
    ApiResponse({ status: 404, description: "Account not found" }),
    ApiResponse({ status: 409, description: "Email already used by another account" })
  );

export const RevokeAccountDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: Number, description: "accounts.id" }),
    ApiOperation({
      summary: "Disable a manager account (root only)",
      description:
        "Sets `enabled` to false; the account row and its data are kept, not deleted. A root account can never be revoked through this route.",
    }),
    ApiResponse({ status: 200, description: "Account revoked", schema: { example: { ok: true } } }),
    ApiResponse({ status: 400, description: "The target account is a root account and cannot be revoked" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Root access required" }),
    ApiResponse({ status: 404, description: "Account not found" })
  );

export const SendInvitationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Send an invitation email with an optional target group (root only)",
      description:
        "If `groupId` is omitted or null, the invitation falls back to whichever group is currently flagged as default, if any. Any previous unaccepted, still-valid invitation for the same email is expired immediately.",
    }),
    ApiBody({ schema: { example: { email: "jdoe@example.com", groupId: 3 } } }),
    ApiResponse({ status: 201, description: "Invitation email sent", schema: { example: { ok: true } } }),
    ApiResponse({ status: 400, description: "Invalid body (e.g. malformed email)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Root access required" }),
    ApiResponse({ status: 404, description: "The given group id does not exist" })
  );

export const GetInvitationDocs = () =>
  applyDecorators(
    ApiParam({ name: "token", type: String, description: "Invitation token from the invite link" }),
    ApiOperation({ summary: "Fetch invitation details by token (public)" }),
    ApiResponse({
      status: 200,
      description: "Invitation details returned",
      schema: { example: { email: "jdoe@example.com", groupName: "Support Team", expiresAt: "2026-07-11T10:00:00.000Z" } },
    }),
    ApiResponse({ status: 400, description: "Invitation already used, or expired" }),
    ApiResponse({ status: 404, description: "Invitation not found" })
  );

export const AcceptInvitationDocs = () =>
  applyDecorators(
    ApiParam({ name: "token", type: String, description: "Invitation token from the invite link" }),
    ApiOperation({ summary: "Accept an invitation and create an account (public)" }),
    ApiBody({
      schema: {
        example: { username: "jdoe", password: "correct-horse-battery-staple", name: "John Doe" },
      },
    }),
    ApiResponse({ status: 201, description: "Account created", schema: { example: { ok: true, username: "jdoe" } } }),
    ApiResponse({ status: 400, description: "Invalid body, or invitation already used, or invitation expired" }),
    ApiResponse({ status: 404, description: "Invitation not found" }),
    ApiResponse({ status: 409, description: "Username already taken" })
  );
