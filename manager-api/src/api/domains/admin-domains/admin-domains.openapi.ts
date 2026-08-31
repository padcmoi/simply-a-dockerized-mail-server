import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

// Own Swagger tag on purpose, separate from "domains" -- reserved for real
// server administrators, never domain owners (see AdminDomainsController).
export const AdminDomainsApi = () =>
  applyDecorators(
    ApiTags("admin-domains"),
    ApiSecurity("apiToken"),
    ApiParam({ name: "domainId", type: Number, example: 1, description: "virtual_domains.id" })
  );

const adminDomainsModifyForbidden = {
  status: 403 as const,
  description:
    "Missing full CRUD (access+create+modify+delete) on the GLOBAL domains resource, and/or " +
    "domain:access+modify for this domainId -- both required together. Deliberately NOT satisfiable by " +
    "owning the domain (no ownership bypass exists at the global tier).",
  schema: { example: { statusCode: 403, message: "missing global domains.modify" } },
};

export const ResizeDomainQuotaDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Resize a domain's quota",
      description:
        "Single-purpose route -- activation is PATCH /domains/:domainId/active. A domain's FQDN cannot be changed " +
        "by any route: it is the identity every mailbox address, maildir column and on-disk maildir path is built " +
        "from. A body carrying `domain` is rejected with 400, never silently ignored.",
    }),
    ApiBody({ schema: { example: { quota: 209715200 } } }),
    ApiResponse({
      status: 200,
      description: "Quota resized",
      schema: {
        example: {
          id: 1,
          ownerId: 7,
          domain: "example.com",
          quota: "209715200",
          active: 1,
          userStartDate: "2026-01-01",
          userEndDate: null,
          lastActivity: "2026-07-04T12:00:00.000Z",
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        "Body validation failed, domainId is not a valid integer, or quota exceeds the bytes still assignable on the mail volume",
      schema: { example: { message: "Validation failed", issues: [] } },
    }),
    ApiResponse(adminDomainsModifyForbidden),
    ApiResponse({
      status: 404,
      description: "Domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );

export const RemoveDomainDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Delete a domain (cascades users, aliases, quota rows, DKIM keys, and its maildir tree on disk)",
      description:
        "Removes /var/mail/vhosts/<domain>/ in full, so no orphan mail survives the row. Disk removal happens " +
        "after the database row is gone: a leftover directory is recoverable, a mailbox whose mail vanished " +
        "while its row lives on is not.",
    }),
    ApiResponse({
      status: 200,
      description: "Domain deleted",
      schema: { example: { ok: true } },
    }),
    ApiResponse({
      status: 400,
      description: "domainId is not a valid integer",
      schema: {
        example: { statusCode: 400, message: "Validation failed (numeric string is expected)", error: "Bad Request" },
      },
    }),
    ApiResponse({
      status: 403,
      description:
        "Missing full CRUD (access+create+modify+delete) on the GLOBAL domains resource, and/or " +
        "domain:access+delete for this domainId -- both required together. Deliberately NOT satisfiable by " +
        "owning the domain (no ownership bypass exists at the global tier).",
      schema: { example: { statusCode: 403, message: "missing global domains.delete" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );
