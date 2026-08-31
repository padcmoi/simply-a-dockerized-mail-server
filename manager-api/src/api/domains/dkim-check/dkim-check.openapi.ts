import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const DkimCheckApi = () =>
  applyDecorators(
    ApiTags("domain-dkim-check"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

export const CheckDkimDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Verify the persisted DKIM key against what is actually published in DNS",
      description:
        "Queries the TXT record at `<selector>._domainkey.<domain>` for this domain's active DKIM selector and " +
        "compares it against the one stored in dkim_keys. `expected` is what's in the database (selector, the " +
        "queried DNS name, and the record value it should have); `found` is what was actually seen in DNS (null " +
        "if nothing resolved). A domain without any persisted key is a valid state (DKIM is optional per domain): " +
        "the response returns `hasKeyInDatabase: false` with `expected`/`found` both null, not an error. A DNS " +
        "lookup failure (NXDOMAIN, timeout, not propagated yet, ...) is reported via `error` and counts as a " +
        "non-match, it never makes the request itself fail. When the current selector's record isn't found, " +
        "`staleSelectorFound` reports whether the previous month's selector (this project's OpenDKIM sidecar " +
        "rotates selectors monthly as `dkim<YYYYMM>`) is still published, catching the common case of a rotated " +
        "key whose DNS record was never updated to match.",
    }),
    ApiResponse({
      status: 200,
      description: "DKIM DNS verification result",
      schema: {
        example: {
          domain: "example.com",
          hasKeyInDatabase: true,
          match: false,
          checkedAt: "2026-07-08T12:00:00.000Z",
          error: "queryTxt ENODATA dkim202607._domainkey.example.com",
          staleSelectorFound: {
            selector: "dkim202606",
            queriedName: "dkim202606._domainkey.example.com",
            txtRecord: "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
          },
          expected: {
            selector: "dkim202607",
            queriedName: "dkim202607._domainkey.example.com",
            value: "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
          },
          found: null,
        },
      },
    }),
    ApiResponse({
      status: 403,
      description:
        'Missing the "dkim" and/or "admin" resources\' access+read domain permissions for this domain (both are required)',
      schema: { example: { statusCode: 403, message: "Missing permission dkim:check-dkim-dns for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    })
  );
