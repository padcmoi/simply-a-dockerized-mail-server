import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../../core/common/pagination.openapi";
import { RSPAMD_HISTORY_SORTABLE_COLUMNS } from "../../../core/rspamd/rspamd.service";

export const DomainRspamdApi = () =>
  applyDecorators(
    ApiTags("domains"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

const historyRowExample = {
  "message-id": "abcd1234@mail.example.com",
  ip: "203.0.113.10",
  action: "no action",
  score: 1.2,
  required_score: 15,
  size: 4096,
  time_real: 0.42,
  unix_time: 1750000000,
  sender_smtp: "sender@example.org",
  sender_mime: "sender@example.org",
  rcpt_smtp: ["user@example.com"],
  rcpt_mime: ["user@example.com"],
  subject: "Example subject",
  user: "user@example.com",
};

export const GetDomainRspamdHistoryDocs = () =>
  applyDecorators(
    ApiPaginationQuery(RSPAMD_HISTORY_SORTABLE_COLUMNS),
    ApiOperation({
      summary: "Rspamd scan history filtered to this domain's recipients, paginated",
      description:
        "Fetches the most recent rows from rspamd's /history endpoint and keeps only rows where at least one " +
        "rcpt_smtp address ends with @<this domain>. `search`/pagination/`sortBy`/`sortDir` are applied in-memory " +
        "over that same fetched window -- there is no deeper archive to page into, so `total` is bounded by `size`.",
    }),
    ApiQuery({ name: "size", required: false, type: String, description: "Max rows to request from rspamd (default 200)" }),
    ApiResponse({
      status: 200,
      description: "Scan history rows for this domain's recipients",
      schema: { example: paginatedExample(historyRowExample) },
    }),
    ApiResponse({ status: 400, description: "Invalid pagination query (e.g. limit not 10/25/50)" }),
    ApiResponse({
      status: 403,
      description: 'Missing the "rspamd" resource\'s access+read domain permissions for this domain (and not its owner/root)',
      schema: { example: { statusCode: 403, message: "Missing permission rspamd:read for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    }),
    ApiResponse({
      status: 502,
      description: "Rspamd responded with a non-2xx status",
      schema: { example: { statusCode: 502, message: "Rspamd returned 500" } },
    }),
    ApiResponse({
      status: 503,
      description: "Rspamd is unreachable from the API container",
      schema: { example: { statusCode: 503, message: "Rspamd unreachable" } },
    })
  );

export const GetDomainRspamdStatsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Rspamd action breakdown computed from this domain's scan history",
      description:
        "Fetches this domain's scan history (same source as GET history, always requesting rspamd's default page " +
        "size) and tallies a count per action -- rspamd has no per-domain stats endpoint of its own.",
    }),
    ApiResponse({
      status: 200,
      description: "Scanned count + per-action breakdown derived from the domain's scan history",
      schema: {
        example: {
          scanned: 128,
          actions: {
            reject: 4,
            "soft reject": 1,
            "rewrite subject": 0,
            "add header": 8,
            greylist: 2,
            "no action": 113,
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Missing the "rspamd" resource\'s access+read domain permissions for this domain (and not its owner/root)',
      schema: { example: { statusCode: 403, message: "Missing permission rspamd:read for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    }),
    ApiResponse({
      status: 502,
      description: "Rspamd responded with a non-2xx status",
      schema: { example: { statusCode: 502, message: "Rspamd returned 500" } },
    }),
    ApiResponse({
      status: 503,
      description: "Rspamd is unreachable from the API container",
      schema: { example: { statusCode: 503, message: "Rspamd unreachable" } },
    })
  );
