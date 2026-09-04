import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../core/common/pagination.openapi";
import {
  GROUP_MEMBERS_SEARCHABLE_COLUMNS,
  GROUP_MEMBERS_SORTABLE_COLUMNS,
  GROUPS_SEARCHABLE_COLUMNS,
  GROUPS_SORTABLE_COLUMNS,
} from "./groups.service";

export const GroupsApi = () => applyDecorators(ApiTags("groups"), ApiSecurity("apiToken"));

const groupItemExample = {
  id: 3,
  name: "Support Team",
  description: "Handles support mailboxes",
  createdAt: "2026-01-15T10:00:00.000Z",
  ownerId: 2,
  ownerEmail: "jdoe@example.com",
  isDefault: false,
  memberCount: 4,
};

const groupDetailExample = {
  ...groupItemExample,
  nonMemberCount: 8,
  owner: { id: 2, email: "jdoe@example.com" },
  globalPermissions: [
    { id: 10, resource: "groups", action: "access" },
    { id: 11, resource: "groups", action: "list-groups" },
  ],
  domainPermissions: [{ id: 5, domainId: 1, domainName: "example.com", resource: "recipients", action: "list-recipients" }],
};

const groupMembersExample = [
  { id: 4, email: "jdoe@example.com", displayName: "John Doe", avatarUrl: "https://example.com/avatar.png" },
];

const permissionsCatalogExample = {
  global: {
    resources: ["sieve", "rspamd", "postfix", "accounts", "api-tokens", "groups", "domains", "superadmin"],
    // Abridged: one resource shown, the real payload carries all of them.
    actionsByResource: { postfix: ["access", "view-postfix-queue"] },
    // Same shape and the same binding AND semantics as domain.dependsOn below.
    // `superadmin` additionally depends on every other global resource with all
    // of its actions, which is what makes ticking superadmin:access grant the
    // whole server (see permission-catalog.ts).
    dependsOn: [{ resource: "groups", dependsOn: [{ resource: "accounts", action: ["access", "list-accounts"] }] }],
  },
  domain: {
    resources: ["domain", "recipients", "aliases", "quotas", "rspamd", "admin", "dkim"],
    actionsByResource: { quotas: ["access", "view-quotas"] },
    dependsOn: [
      { resource: "recipients", dependsOn: [{ resource: "domain", action: ["access"] }] },
      { resource: "aliases", dependsOn: [{ resource: "domain", action: ["access"] }] },
      { resource: "quotas", dependsOn: [{ resource: "domain", action: ["access"] }] },
      { resource: "rspamd", dependsOn: [{ resource: "domain", action: ["access"] }] },
      { resource: "admin", dependsOn: [{ resource: "domain", action: ["access"] }] },
      {
        resource: "dkim",
        dependsOn: [
          { resource: "domain", action: ["access"] },
          { resource: "admin", action: ["access", "view-admin-page"] },
        ],
      },
    ],
  },
};

const idParam = () => ApiParam({ name: "id", type: Number, description: "groups.id" });

export const ListGroupsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(GROUPS_SORTABLE_COLUMNS, GROUPS_SEARCHABLE_COLUMNS),
    ApiOperation({ summary: "List all groups, paginated" }),
    ApiResponse({ status: 200, description: "Groups returned", schema: { example: paginatedExample(groupItemExample) } }),
    ApiResponse({ status: 400, description: "Invalid pagination query (e.g. limit not 10/25/50)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:list-groups global permission" })
  );

export const GetPermissionsCatalogDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List every resource/action a group permission can target",
      description:
        "Static catalog, not tied to any specific group -- the exact same resources and per-resource actions " +
        "enforced server-side by the Zod validation on set*Permissions. `actionsByResource` is keyed by resource: " +
        "two resources do not share one vocabulary. Lets a client build the " +
        "permission grid without hardcoding its own copy of this list. `global.dependsOn` and `domain.dependsOn` " +
        "each list, per resource, which other (resource, action[]) pairs must also be granted for that resource's " +
        "own actions to have any effect -- every entry is mandatory (AND): every dependsOn array entry, and every " +
        'action listed within one entry\'s action[]. Every domain resource except "domain" itself requires at ' +
        "least domain:access (dkim also requires admin:access + admin:view-admin-page); on the global tier, groups " +
        "requires accounts:access + accounts:list-accounts, and superadmin depends on every other global resource " +
        "with all of its actions. The guard enforces both " +
        "at check time regardless of what's saved, so a client should reflect it too rather than allow a state " +
        "that looks granted but is actually inert.",
    }),
    ApiResponse({ status: 200, description: "Catalog returned", schema: { example: permissionsCatalogExample } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:view-group global permission" })
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
    ApiResponse({ status: 403, description: "Missing groups:access + groups:create-group global permission" }),
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
    ApiResponse({ status: 403, description: "Missing groups:access + groups:edit-group global permission" }),
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
    ApiResponse({ status: 403, description: "Missing groups:access + groups:delete-group global permission" }),
    ApiResponse({ status: 404, description: "Group not found" })
  );

export const GetGroupDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({ summary: "Fetch a group with its owner, members count and permissions" }),
    ApiResponse({ status: 200, description: "Group detail returned", schema: { example: groupDetailExample } }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:list-groups global permission" }),
    ApiResponse({ status: 404, description: "Group not found" })
  );

export const SetGlobalPermissionsDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Replace the global (non domain-scoped) permissions granted to a group",
      description:
        "Full replace, not a merge. Anti-escalation: a non-root actor may only grant permissions they themselves already hold (checked against their own effective global permissions); granting anything else is rejected. Anti-lockout: a non-root actor is also blocked from making a change that would leave zero groups in the whole system able to manage groups (groups:access + groups:edit-group-global-permissions together). Root is exempt from both checks.",
    }),
    ApiBody({
      schema: {
        example: {
          permissions: [
            { resource: "accounts", action: "access" },
            { resource: "accounts", action: "list-accounts" },
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
        "Missing groups:access + groups:edit-group-global-permissions global permission; or (non-root only) attempting to grant a permission not held; or the change would leave no group able to manage groups",
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
            { domainId: 1, resource: "recipients", action: "list-recipients" },
            { domainId: 1, resource: "aliases", action: "edit-alias" },
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
        "Missing groups:access + groups:edit-group-domain-permissions global permission; or (non-root only) attempting to grant a domain permission not held",
    }),
    ApiResponse({ status: 404, description: "Group not found, or one or more domain IDs do not exist" })
  );

export const UpdateOwnerDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Transfer group ownership (root or current owner only)",
      description:
        "Not gated by a @RequireGlobalPermissions decorator: enforced purely at the service level (isRoot || group.ownerId === actingUser.id). Any other authenticated account is rejected, even one holding groups:edit-group.",
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
    ApiPaginationQuery(GROUP_MEMBERS_SORTABLE_COLUMNS, GROUP_MEMBERS_SEARCHABLE_COLUMNS),
    ApiOperation({
      summary: "List the members of a group",
      description:
        "Paginated and searchable when `limit` is given: search matches the member account's email or display name. Omitting `limit` returns the full member array (legacy, internal callers).",
    }),
    ApiResponse({
      status: 200,
      description: "Members returned",
      schema: { example: paginatedExample(groupMembersExample[0], 1) },
    }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Missing groups:access + groups:list-group-members global permission" }),
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

export const AddMembersDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Add several accounts to a group in one call (root or current owner only)",
      description:
        "Bulk counterpart of the single add: same owner-or-root-or-permitted rule, one anti-escalation check on the group's whole permission set. Idempotent (already-member ids are no-ops).",
    }),
    ApiBody({ schema: { example: { accountIds: ["4f1c...", "9a2b..."] } } }),
    ApiResponse({ status: 201, description: "Accounts added", schema: { example: { added: 4 } } }),
    ApiResponse({ status: 400, description: "Invalid body" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Only root or the group's current owner may add members" }),
    ApiResponse({ status: 404, description: "Group not found, or one of the accounts does not exist" })
  );

export const AddAllMembersDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Assign every known account to a group (root only)",
      description:
        "Root-only, not an ACL: the route's empty @RequireGlobalPermissions clears the guard for any authenticated caller and the isRoot rule is enforced in the service. Idempotent -- inserts a membership per account only if absent, leaving existing memberships untouched, so re-running also folds in accounts created since the last run.",
    }),
    ApiResponse({
      status: 201,
      description: "All accounts assigned; full member list returned",
      schema: { example: groupMembersExample },
    }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Only a root account may bulk-assign every account" }),
    ApiResponse({ status: 404, description: "Group not found" })
  );

export const RemoveAllMembersDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Remove every member of a group (root only)",
      description:
        "Root-only counterpart to the bulk assign: clears the group's membership. Enforced in the service like its counterpart. Idempotent.",
    }),
    ApiResponse({
      status: 200,
      description: "All members removed; empty member list returned",
      schema: { example: [] },
    }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Only a root account may remove every member" }),
    ApiResponse({ status: 404, description: "Group not found" })
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
