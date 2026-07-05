import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

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

export const GetDomainQuotasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Live quota snapshot for this domain: aggregate counters + per-recipient counters from dovecot",
      description:
        "Reads virtual_quota_domains and virtual_quota_users as-is (no aggregation performed here). `domain` is " +
        "null if dovecot has not yet written an aggregate row for this domain; `recipients` is an empty array if " +
        "none exist yet, sorted by email.",
    }),
    ApiResponse({
      status: 200,
      description: "Domain-level and per-recipient quota counters",
      schema: {
        example: {
          domain: {
            id: 1,
            domain: "example.com",
            bytes: "104857600",
            messages: "42",
            lastActivity: "2026-07-04T12:00:00.000Z",
          },
          recipients: [
            {
              id: 5,
              domain: "example.com",
              email: "user@example.com",
              bytes: "52428800",
              messages: "21",
              lastActivity: "2026-07-04T11:30:00.000Z",
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Missing the "quotas" resource\'s access+read domain permissions for this domain (and not its owner/root)',
      schema: { example: { statusCode: 403, message: "Missing permission quotas:read for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    })
  );
