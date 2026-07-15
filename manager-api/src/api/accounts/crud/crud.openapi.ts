import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../../core/common/pagination.openapi";
import { ACCOUNTS_SORTABLE_COLUMNS } from "./crud.service";

export const AccountsApi = () => applyDecorators(ApiTags("accounts"), ApiSecurity("apiToken"));

const accountNameExample = { id: 5, email: "jdoe@example.com", displayName: "John Doe" };

const accountListItemExample = {
  id: 5,
  email: "jdoe@example.com",
  displayName: "John Doe",
  isRoot: false,
  enabled: true,
  lastLogin: "2026-06-30T08:12:00.000Z",
  createdAt: "2026-01-10T09:00:00.000Z",
  groups: [{ id: 3, name: "Support Team" }],
};

export const ListAccountNamesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List every account's id, email and display name (any authenticated account)",
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
      description: "Typeahead filter on email / display name (LIKE)",
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

const accountOverviewExample = {
  account: accountDetailExample,
  domains: [{ id: 1, domain: "example.com", active: true, quota: "0" }],
  recipients: [{ id: 1, email: "jane@example.com", domain: "example.com", active: true, quota: "0" }],
};

export const GetAccountOverviewDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: String, description: "accounts.id (uuid)" }),
    ApiOperation({
      summary: "Get an account overview: the account plus the domains and recipients it owns",
      description:
        "Powers the account dashboard page. Returns the account (with its groups) alongside every `virtual_domains` and `virtual_users` row whose `owner_id` is this account, so an administrator sees everything an account owns in one place.",
    }),
    ApiResponse({ status: 200, description: "Overview returned", schema: { example: accountOverviewExample } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Insufficient permissions (accounts:view-account required)" }),
    ApiResponse({ status: 404, description: "Account not found" })
  );

export const UpdateAccountDocs = () =>
  applyDecorators(
    ApiParam({ name: "id", type: String, description: "accounts.id (uuid)" }),
    ApiOperation({
      summary: "Update a manager account's full profile and enabled status",
      description:
        "Edits every editable field of a user: email (login identity), the enabled flag, and all account_profiles attributes (display name, avatar, phone, address, city, postal code, country). Setting or changing the city re-geocodes latitude/longitude. Group membership is managed separately via the groups endpoints, not through this route.",
    }),
    ApiBody({
      schema: {
        example: {
          email: "jdoe@example.com",
          displayName: "John Doe",
          avatarUrl: "https://example.com/avatar.png",
          phone: "+33123456789",
          addressLine: "10 rue de la Paix",
          addressComplement: "Apt 4B",
          city: "Paris",
          postalCode: "75002",
          country: "France",
          enabled: true,
        },
      },
    }),
    ApiResponse({ status: 200, description: "Account updated", schema: { example: accountDetailExample } }),
    ApiResponse({ status: 400, description: "Invalid body, or attempting to disable a root account" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Insufficient permissions (accounts:edit-account required)" }),
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
