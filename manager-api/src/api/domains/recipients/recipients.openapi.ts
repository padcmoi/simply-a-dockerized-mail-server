import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../../core/common/pagination.openapi";
import { RECIPIENTS_SORTABLE_COLUMNS } from "./recipients.service";

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

const recipientListItemExample = {
  id: 1,
  ownerId: null,
  domain: "example.com",
  email: "jdoe@example.com",
  maildir: "example.com/jdoe/",
  quota: "104857600",
  usedBytes: "8192",
  active: 1,
  uid: "vmail",
  gid: "vmail",
  userStartDate: "2026-01-01",
  userEndDate: null,
  lastActivity: "2026-07-01T12:00:00.000Z",
};

export const ListRecipientsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(RECIPIENTS_SORTABLE_COLUMNS),
    ApiOperation({
      summary: "List recipients that belong to this domain, paginated",
      description:
        'Every recipient row also carries a computed `usedBytes` (from virtual_quota_users, `"0"` if dovecot ' +
        "hasn't written a counter for it yet). `sortBy=usedBytes` is accepted despite not being a real column -- " +
        "it sorts on a joined value.",
    }),
    ApiResponse({
      status: 200,
      description: "Recipients returned",
      schema: { example: paginatedExample(recipientListItemExample) },
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
      description: "Missing permission recipients:access or recipients:list-recipients for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );

export const GetRecipientsHeadroomDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "How much quota this domain still has left for its recipients",
      description:
        "`available` = the domain's own quota minus the sum of the quotas already allocated to its recipients. " +
        "It is the ceiling a new recipient's quota must fit under, and it can be negative for a domain whose " +
        "recipients were overcommitted before this rule existed. All sizes in bytes.",
    }),
    ApiResponse({
      status: 200,
      description: "Headroom returned",
      schema: { example: { domainQuota: 157286400, allocated: 34603008, available: 122683392 } },
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
          usedBytes: "0",
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
      description: "Missing permission recipients:access or recipients:view-recipient for this domain",
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
      description:
        "Body validation failed, domainId is not a valid integer, or the quota exceeds what the domain has left " +
        "(its own quota minus the quotas already allocated to its other recipients). `code` and `params` let a " +
        "localised client build its own sentence; `message` is the English one.",
      schema: {
        example: {
          statusCode: 400,
          code: "recipients.quotaExceedsDomain",
          params: { domain: "example.com", availableMb: 64, domainQuotaMb: 117, allocatedMb: 53 },
          message:
            "Recipient quota exceeds what example.com has left: 64 MB available " +
            "(domain quota 117 MB, 53 MB already allocated to other recipients)",
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission recipients:access or recipients:create-recipient for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    }),
    ApiResponse({
      status: 409,
      description: "localPart is 'postmaster' (reserved), or the recipient email already exists",
      schema: {
        example: {
          statusCode: 409,
          code: "recipients.alreadyExists",
          params: { email: "jdoe@example.com" },
          message: "Recipient jdoe@example.com already exists",
        },
      },
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
      description:
        "Body validation failed, domainId/id is not a valid integer, the quota exceeds what the domain has left, " +
        "or it would drop below the bytes the mailbox already stores",
      schema: { example: { message: "Validation failed", issues: [] } },
    }),
    ApiResponse({
      status: 403,
      description:
        "Missing permission recipients:access or recipients:edit-recipient for this domain, or target is postmaster@<domain> (which cannot be modified)",
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
        "Missing permission recipients:access or recipients:delete-recipient for this domain, or target is postmaster@<domain> (which cannot be deleted)",
      schema: { example: { statusCode: 403, message: "postmaster@ cannot be deleted" } },
    }),
    ApiResponse({
      status: 404,
      description: "Parent domain not found, or recipient not found in this domain",
      schema: { example: { statusCode: 404, message: "Recipient #1 not found in example.com" } },
    })
  );
