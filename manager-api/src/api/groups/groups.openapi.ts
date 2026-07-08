import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../core/common/pagination.openapi";
import { GROUPS_SORTABLE_COLUMNS } from "./groups.service";

export const GroupsApi = () => applyDecorators(ApiTags("groups"), ApiSecurity("apiToken"));

const groupItemExample = {
  id: 3,
  name: "Support Team",
  description: "Handles support mailboxes",
  createdAt: "2026-01-15T10:00:00.000Z",
  ownerId: 2,
  ownerUsername: "jdoe",
  isDefault: false,
  memberCount: 4,
};

const groupDetailExample = {
  ...groupItemExample,
  owner: { id: 2, username: "jdoe" },
  globalPermissions: [
    { id: 10, resource: "groups", action: "access" },
    { id: 11, resource: "groups", action: "read" },
  ],
  domainPermissions: [{ id: 5, domainId: 1, domainName: "example.com", resource: "recipients", action: "read" }],
};

const groupMembersExample = [{ id: 4, username: "jdoe", name: "John Doe", email: "jdoe@example.com" }];

const idParam = () => ApiParam({ name: "id", type: Number, description: "groups.id" });

export const ListGroupsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(GROUPS_SORTABLE_COLUMNS),
    ApiOperation({ summary: "List all groups, paginated" }),
    ApiResponse({ status: 200, description: "Groups returned", schema: { example: paginatedExample(groupItemExample) } }),
    ApiResponse({ status: 400, description: "Invalid pagination query (e.g. limit not 10/25/50)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:read global permission" })
  );

export const CreateGroupDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a group (the creating account becomes its owner)",
      description:
        "If `isDefault` is true, this group becomes the sole default group used to auto-assign new invitations that don't target a specific group; any previously default group is unset.",
    }),
    ApiBody({
      schema: {
        example: { name: "Support Team", description: "Handles support mailboxes", isDefault: false },
      },
    }),
    ApiResponse({ status: 201, description: "Group created", schema: { example: groupItemExample } }),
    ApiResponse({ status: 400, description: "Invalid body (e.g. empty/too-long name, description too long)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:create global permission" }),
    ApiResponse({ status: 409, description: "A group with this name already exists" })
  );

export const UpdateGroupDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Rename / update the description of a group",
      description: "All fields are optional. Setting `isDefault` to true unsets any other group currently flagged as default.",
    }),
    ApiBody({
      schema: {
        example: { name: "Support Team", description: "Handles support and escalations", isDefault: true },
      },
    }),
    ApiResponse({ status: 200, description: "Group updated", schema: { example: groupItemExample } }),
    ApiResponse({ status: 400, description: "Invalid body" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:modify global permission" }),
    ApiResponse({ status: 404, description: "Group not found" }),
    ApiResponse({ status: 409, description: "Another group already uses this name" })
  );

export const RemoveGroupDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Delete a group (cascades members and permissions)",
      description: "Members of the deleted group are only detached (accounts.group_id set to null), never deleted themselves.",
    }),
    ApiResponse({ status: 200, description: "Group deleted", schema: { example: { ok: true } } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:delete global permission" }),
    ApiResponse({ status: 404, description: "Group not found" })
  );

export const GetGroupDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({ summary: "Fetch a group with its owner, members count and permissions" }),
    ApiResponse({ status: 200, description: "Group detail returned", schema: { example: groupDetailExample } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:read global permission" }),
    ApiResponse({ status: 404, description: "Group not found" })
  );

export const SetGlobalPermissionsDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Replace the global (non domain-scoped) permissions granted to a group",
      description:
        "Full replace, not a merge. Anti-escalation: a non-root actor may only grant permissions they themselves already hold (checked against their own effective global permissions); granting anything else is rejected. Anti-lockout: a non-root actor is also blocked from making a change that would leave zero groups in the whole system able to manage groups (groups:access + groups:modify together). Root is exempt from both checks.",
    }),
    ApiBody({
      schema: {
        example: {
          permissions: [
            { resource: "accounts", action: "access" },
            { resource: "accounts", action: "read" },
          ],
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Permissions replaced; updated group detail returned",
      schema: { example: groupDetailExample },
    }),
    ApiResponse({ status: 400, description: "Invalid body (unknown resource/action)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({
      status: 403,
      description:
        "Missing groups:access + groups:modify global permission; or (non-root only) attempting to grant a permission not held; or the change would leave no group able to manage groups",
    }),
    ApiResponse({ status: 404, description: "Group not found" })
  );

export const SetDomainPermissionsDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Replace the domain-scoped permissions granted to a group",
      description:
        "Full replace, not a merge. Anti-escalation: a non-root actor may only grant, for a given domain, permissions they themselves already hold on that same domain; granting anything else is rejected. Root is exempt.",
    }),
    ApiBody({
      schema: {
        example: {
          permissions: [
            { domainId: 1, resource: "recipients", action: "read" },
            { domainId: 1, resource: "aliases", action: "modify" },
          ],
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Permissions replaced; updated group detail returned",
      schema: { example: groupDetailExample },
    }),
    ApiResponse({ status: 400, description: "Invalid body (unknown resource/action, non-positive domainId)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({
      status: 403,
      description:
        "Missing groups:access + groups:modify global permission; or (non-root only) attempting to grant a domain permission not held",
    }),
    ApiResponse({ status: 404, description: "Group not found, or one or more domain IDs do not exist" })
  );

export const UpdateOwnerDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Transfer group ownership (root or current owner only)",
      description:
        "Not gated by a @RequireGlobalPermissions decorator: enforced purely at the service level (isRoot || group.ownerId === actingUser.id). Any other authenticated account is rejected, even one holding groups:modify.",
    }),
    ApiBody({ schema: { example: { newOwnerId: 5 } } }),
    ApiResponse({
      status: 200,
      description: "Ownership transferred; updated group detail returned",
      schema: { example: groupDetailExample },
    }),
    ApiResponse({ status: 400, description: "Invalid body" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Only root or the group's current owner may transfer ownership" }),
    ApiResponse({ status: 404, description: "Group not found, or the target account does not exist" })
  );

export const ListMembersDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({ summary: "List the members of a group" }),
    ApiResponse({ status: 200, description: "Members returned", schema: { example: groupMembersExample } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:read global permission" }),
    ApiResponse({ status: 404, description: "Group not found" })
  );

export const AddMemberDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Add an account to a group (root or current owner only)",
      description:
        "Not gated by a @RequireGlobalPermissions decorator: enforced purely at the service level (isRoot || group.ownerId === actingUser.id). Single-group model: if the account already belongs to another group, it is moved here.",
    }),
    ApiBody({ schema: { example: { accountId: 7 } } }),
    ApiResponse({
      status: 201,
      description: "Account added; full member list returned",
      schema: { example: groupMembersExample },
    }),
    ApiResponse({ status: 400, description: "Invalid body" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Only root or the group's current owner may add members" }),
    ApiResponse({ status: 404, description: "Group not found, or the account does not exist" })
  );

export const RemoveMemberDocs = () =>
  applyDecorators(
    idParam(),
    ApiParam({ name: "accountId", type: Number, description: "accounts.id of the member to remove" }),
    ApiOperation({
      summary: "Remove an account from a group (root or current owner only)",
      description:
        "Not gated by a @RequireGlobalPermissions decorator: enforced purely at the service level (isRoot || group.ownerId === actingUser.id).",
    }),
    ApiResponse({
      status: 200,
      description: "Account removed; remaining member list returned",
      schema: { example: groupMembersExample },
    }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Only root or the group's current owner may remove members" }),
    ApiResponse({ status: 404, description: "Group not found, or the account is not a member of this group" })
  );
