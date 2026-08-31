import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const DeliverabilityApi = () => applyDecorators(ApiTags("deliverability"), ApiSecurity("apiToken"));

export const RunDeliverabilityDocs = () =>
  applyDecorators(
    ApiParam({ name: "domainId", type: Number, example: 1, description: "Domain id" }),
    ApiOperation({
      summary: "Run every deliverability check against this domain, live",
      description:
        "Answers a report of independent checks across four sections (identity, dns, server, reputation). Nothing is " +
        "cached and nothing is stored: every value is read at call time from DNS, from the mail server's own SMTP " +
        "port and from the public blocklists. The checks mirror docs/delivery/deliverability.md one for one. A check " +
        "answers `pass`, `warn`, `fail` or `skip`, and `skip` genuinely means unknown, never clean: a blocklist that " +
        "refuses queries from public resolvers is reported as skipped rather than turned into a green tick. Each " +
        "result carries a stable `id` the interface translates, plus the raw evidence that was read.",
    }),
    ApiResponse({
      status: 200,
      description: "The report",
      schema: {
        example: {
          domain: "example.org",
          checkedAt: "2026-08-28T19:00:00.000Z",
          mxHost: "mail.example.org",
          mailIp: "203.0.113.10",
          counts: { pass: 22, warn: 3, fail: 1, skip: 2 },
          checks: [
            { id: "ptr-fcrdns", section: "identity", status: "pass", evidence: "mail.example.org -> 203.0.113.10" },
            { id: "dkim-published", section: "dns", status: "fail", evidence: "dkim202601._domainkey.example.org" },
          ],
        },
      },
    })
  );
