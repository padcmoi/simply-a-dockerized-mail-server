import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery } from "../../../core/common/pagination.openapi";

// `id` has no dedicated UI column/header but stays an accepted value since
// it's the existing default -- keeps `resolveSortColumn`'s fallback
// type-safe without a cast. Lives here (not the controller) since the
// controller already imports from this file -- the reverse would be circular.
// `quota` is not a virtual_quota_users column: it belongs to virtual_users and
// is joined in (see `snapshot`), the mirror image of recipients.service.ts
// joining `usedBytes` the other way round. Sorting on it takes its own branch
// there rather than an `order` on the entity.
export const QUOTAS_SORTABLE_COLUMNS = ["email", "quota", "bytes", "messages", "lastActivity", "id"] as const;

export const QuotasApi = () =>
  applyDecorators(
    ApiTags("domain-quotas"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

const recipientQuotaExample = {
  id: 5,
  domain: "example.com",
  email: "user@example.com",
  quota: "104857600",
  bytes: "52428800",
  messages: "21",
  lastActivity: "2026-07-04T11:30:00.000Z",
};

export const GetDomainQuotasDocs = () =>
  applyDecorators(
    ApiPaginationQuery(QUOTAS_SORTABLE_COLUMNS),
    ApiOperation({
      summary: "Live quota snapshot for this domain: aggregate counters + paginated per-recipient counters from dovecot",
      description:
        "Reads virtual_quota_domains and virtual_quota_users as-is (no aggregation performed here), and adds the " +
        "reserved `quota` each counter row is measured against: virtual_domains.quota for the aggregate, " +
        "virtual_users.quota for every recipient. `domain` is null if dovecot has not yet written an aggregate row " +
        "for this domain. `recipients` is `{ items, total }` when `limit` is passed, or a bare array (unpaginated, " +
        "sorted by email) otherwise.",
    }),
    ApiResponse({
      status: 200,
      description: "Domain-level and per-recipient quota counters",
      schema: {
        example: {
          domain: {
            id: 1,
            domain: "example.com",
            quota: "157286400",
            bytes: "104857600",
            messages: "42",
            lastActivity: "2026-07-04T12:00:00.000Z",
          },
          recipients: { items: [recipientQuotaExample], total: 1 },
        },
      },
    }),
    ApiResponse({ status: 400, description: "Invalid pagination query (e.g. limit not 10/25/50)" }),
    ApiResponse({
      status: 403,
      description: 'Missing the "quotas" resource\'s access+read domain permissions for this domain (and not its owner/root)',
      schema: { example: { statusCode: 403, message: "Missing permission quotas:view-quotas for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    })
  );
