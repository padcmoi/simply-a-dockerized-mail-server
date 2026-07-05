import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const RspamdApi = () => applyDecorators(ApiTags("rspamd"), ApiSecurity("apiToken"));

const RspamdUnreachableResponse = () =>
  ApiResponse({
    status: 503,
    description: "Could not connect to the Rspamd controller at all (e.g. the rspamd container is down)",
    schema: {
      example: { statusCode: 503, message: "Rspamd unreachable" },
    },
  });

const RspamdBadGatewayResponse = () =>
  ApiResponse({
    status: 502,
    description: "Rspamd answered but with a non-2xx status",
    schema: {
      example: { statusCode: 502, message: "Rspamd returned 500" },
    },
  });

const RspamdForbiddenResponse = () =>
  ApiResponse({
    status: 403,
    description:
      "Missing the `rspamd:access` and/or `rspamd:read` global permission (the message names whichever is missing first)",
    schema: {
      example: { statusCode: 403, message: "Missing permission rspamd:access", error: "Forbidden" },
    },
  });

export const GetStatsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Proxy Rspamd global stats (scanned, rejected, greylisted, clean)",
      description: "Directly proxies the JSON returned by Rspamd's own `/stat` controller endpoint.",
    }),
    ApiResponse({
      status: 200,
      description: "Rspamd global stats",
      schema: {
        example: {
          version: "3.8.1",
          uptime: 123456,
          scanned: 4820,
          learned: 312,
          spam_count: 640,
          ham_count: 4180,
          connections: 512,
          actions: {
            reject: 500,
            "soft reject": 20,
            "rewrite subject": 5,
            "add header": 115,
            greylist: 40,
            "no action": 4140,
          },
        },
      },
    }),
    RspamdForbiddenResponse(),
    RspamdUnreachableResponse(),
    RspamdBadGatewayResponse()
  );

export const GetHistoryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Rspamd scan history, optionally filtered by recipient domain",
      description:
        "Proxies Rspamd's own `/history` controller endpoint. When `domain` is given, rows are filtered in-memory " +
        "to only those whose `rcpt_smtp` list contains an address ending in `@<domain>` (the filter is applied " +
        "after fetching `size` rows from Rspamd, so a narrow domain filter combined with a small `size` may return " +
        "fewer rows than expected).",
    }),
    ApiQuery({
      name: "domain",
      required: false,
      type: String,
      example: "example.com",
      description: "Only return rows delivered to a recipient on this FQDN",
    }),
    ApiQuery({
      name: "size",
      required: false,
      type: Number,
      example: 200,
      description: "Max rows to fetch from Rspamd before any domain filtering (default 200)",
    }),
    ApiResponse({
      status: 200,
      description: "Rspamd scan history rows, newest first",
      schema: {
        example: [
          {
            "message-id": "abc123@example.com",
            ip: "203.0.113.10",
            action: "reject",
            score: 15.2,
            required_score: 15,
            size: 4096,
            time_real: 0.42,
            unix_time: 1751500000,
            sender_smtp: "spam@baddomain.example",
            sender_mime: "spam@baddomain.example",
            rcpt_smtp: ["user@example.com"],
            rcpt_mime: ["user@example.com"],
            subject: "Sample subject",
            user: "",
          },
        ],
      },
    }),
    RspamdForbiddenResponse(),
    RspamdUnreachableResponse(),
    RspamdBadGatewayResponse()
  );
