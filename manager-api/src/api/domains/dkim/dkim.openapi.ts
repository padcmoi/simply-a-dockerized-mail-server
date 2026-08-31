import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const DkimApi = () =>
  applyDecorators(
    ApiTags("domain-dkim"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

export const ListDkimDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List active DKIM selectors for this domain",
      description:
        "Reads selectors persisted in dkim_keys. If none are found for the domain (e.g. rows never persisted by an " +
        "older codepath), the OpenDKIM sidecar's live key list is fetched once, persisted (self-healing), and returned.",
    }),
    ApiResponse({
      status: 200,
      description: "DKIM selectors for this domain (empty array if none exist yet)",
      schema: {
        example: [
          {
            domain: "example.com",
            selector: "dkim202607",
            dnsName: "dkim202607._domainkey",
            txtRecord: "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
          },
        ],
      },
    }),
    ApiResponse({
      status: 403,
      description:
        'Missing the "dkim" and/or "admin" resources\' access+read domain permissions for this domain (both are required)',
      schema: { example: { statusCode: 403, message: "Missing permission dkim:view-dkim for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    })
  );

export const RotateDkimDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Replace all DKIM selectors for this domain with a single freshly generated one",
      description:
        "Removes every existing DKIM selector for this domain (best-effort against the OpenDKIM sidecar; failures " +
        "here are ignored) and then generates one new selector, so only a single active key exists once rotation " +
        "completes. Publish the returned TXT record before relying on the new key, since the previous key(s) stop " +
        "being served immediately.",
    }),
    ApiResponse({
      status: 201,
      description: "New DKIM selector generated and persisted",
      schema: {
        example: {
          domain: "example.com",
          selector: "dkim202607",
          dnsName: "dkim202607._domainkey",
          txtRecord: "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
        },
      },
    }),
    ApiResponse({
      status: 403,
      description:
        'Missing the "dkim" and/or "admin" resources\' access+create+modify+delete domain permissions for this domain ' +
        "(both resources required -- rotation removes the old key and creates a new one)",
      schema: { example: { statusCode: 403, message: "Missing permission dkim:rotate-dkim-key for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    })
  );

export const RemoveDkimDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Remove a specific DKIM selector for this domain (after its TTL expired)",
      description:
        "Deletes the selector's key material and table entries from the OpenDKIM sidecar, then removes the matching " +
        "row from dkim_keys. Safe to call again for a selector that no longer exists on either side.",
    }),
    ApiParam({
      name: "selector",
      type: String,
      description: "DKIM selector to remove, e.g. dkim202607",
    }),
    ApiResponse({
      status: 200,
      description: "Selector removed",
      schema: {
        example: {
          domain: "example.com",
          selector: "dkim202601",
          removedFiles: ["dkim202601.private", "dkim202601.txt"],
          removedKeyTable: 1,
          removedSigningTable: 1,
        },
      },
    }),
    ApiResponse({
      status: 403,
      description:
        'Missing the "dkim" and/or "admin" resources\' access+delete domain permissions for this domain (both are required)',
      schema: { example: { statusCode: 403, message: "Missing permission dkim:delete-dkim-key for domain #12" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain #{domainId} does not exist",
      schema: { example: { statusCode: 404, message: "Domain #12 not found" } },
    })
  );
