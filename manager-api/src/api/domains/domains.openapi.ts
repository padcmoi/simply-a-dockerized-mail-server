import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../core/common/pagination.openapi";
import { DOMAINS_SORTABLE_COLUMNS } from "./domains.service";

export const DomainsApi = () => applyDecorators(ApiTags("domains"), ApiSecurity("apiToken"));

const domainListItemExample = {
  id: 1,
  ownerId: 7,
  ownerUsername: "jdoe",
  domain: "example.com",
  quota: "104857600",
  usedBytes: "8192",
  active: 1,
  userStartDate: "2026-01-01",
  userEndDate: null,
  lastActivity: "2026-07-01T12:00:00.000Z",
};

export const ListDomainsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(DOMAINS_SORTABLE_COLUMNS),
    ApiOperation({
      summary: "List managed domains, paginated",
      description:
        "Every domain row also carries a computed `ownerUsername` (resolved from `ownerId`) and `usedBytes` " +
        '(from virtual_quota_domains, `"0"` if the domain has no quota row yet).',
    }),
    ApiResponse({
      status: 200,
      description: "Domains returned",
      schema: { example: paginatedExample(domainListItemExample) },
    }),
    ApiResponse({ status: 400, description: "Invalid pagination query (e.g. limit not 10/25/50)" }),
    ApiResponse({
      status: 403,
      description: "Missing permission domains:access or domains:read",
    })
  );

export const DiskUsageDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Mail volume capacity (total / free / reserved by existing domains / still assignable)",
    }),
    ApiResponse({
      status: 200,
      description: "Capacity figures, all in bytes",
      schema: {
        example: {
          totalBytes: 536870912000,
          freeBytes: 214748364800,
          reservedBytes: 104857600,
          assignableBytes: 214748364800,
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission domains:access",
    })
  );

export const GetDomainDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Fetch a domain by id" }),
    ApiParam({
      name: "domainId",
      type: Number,
      example: 1,
      description: "virtual_domains.id",
    }),
    ApiResponse({
      status: 200,
      description: "Domain returned",
      schema: {
        example: {
          id: 1,
          ownerId: 7,
          ownerUsername: "jdoe",
          domain: "example.com",
          quota: "104857600",
          active: 1,
          userStartDate: "2026-01-01",
          userEndDate: null,
          lastActivity: "2026-07-01T12:00:00.000Z",
        },
      },
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
      description: "Missing permission domain:access or domain:read for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );

export const CreateDomainDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a managed domain (reserves postmaster, provisions DKIM key best-effort)",
      description:
        "The caller becomes the domain's owner. A postmaster@<domain> mailbox is always reserved (inactive, quota 0). " +
        "DKIM key generation is attempted but failures there are only logged, not surfaced -- the domain is still created.",
    }),
    ApiBody({
      schema: {
        example: {
          domain: "example.com",
          quota: 104857600,
          active: true,
          userEndDate: null,
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: "Domain created",
      schema: {
        example: {
          id: 1,
          ownerId: 7,
          domain: "example.com",
          quota: "104857600",
          active: 1,
          userStartDate: "2026-07-04",
          userEndDate: null,
          dkim: {
            domain: "example.com",
            selector: "mail",
            dnsName: "mail._domainkey.example.com",
            txtRecord: "v=DKIM1; k=rsa; p=BASE64...",
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "Validation failed, or quota exceeds the bytes still assignable on the mail volume",
      schema: { example: { message: "Validation failed", issues: [] } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission domains:access or domains:create",
    }),
    ApiResponse({
      status: 409,
      description: "Domain already exists",
      schema: { example: { statusCode: 409, message: "Domain example.com already exists" } },
    })
  );

// Resize-quota/delete docs live in admin-domains.openapi.ts now -- see
// AdminDomainsController (PATCH/DELETE /admin/domains/:domainId). Renaming a
// domain is not offered by any route.

export const TransferDomainOwnerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Transfer domain ownership (root or current owner only)",
      description: "No generic permission decorator gates this route -- the service itself enforces root-or-current-owner.",
    }),
    ApiParam({
      name: "domainId",
      type: Number,
      example: 1,
      description: "virtual_domains.id",
    }),
    ApiBody({
      schema: {
        example: {
          newOwnerId: 12,
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Ownership transferred",
      schema: {
        example: {
          id: 1,
          ownerId: 12,
          domain: "example.com",
          quota: "104857600",
          active: 1,
          userStartDate: "2026-01-01",
          userEndDate: null,
          lastActivity: "2026-07-04T12:00:00.000Z",
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "Body validation failed (newOwnerId missing or not a positive integer), or domainId is not a valid integer",
      schema: { example: { message: "Validation failed", issues: [] } },
    }),
    ApiResponse({
      status: 403,
      description: "Caller is neither root nor the current domain owner",
      schema: { example: { statusCode: 403, message: "Only root or the current domain owner can transfer ownership" } },
    }),
    ApiResponse({
      status: 404,
      description: "Domain or new owner account not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );

export const SetDomainActiveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Activate or deactivate a domain (Administration page)",
      description:
        "An inactive domain stops accepting inbound mail for its mailboxes. Deliberately owner-accessible " +
        '(unlike quota/delete, see admin-domains.openapi.ts) -- gated by the domain-tier "admin"+"domain" ' +
        "resources together, see DomainsController.setActive.",
    }),
    ApiParam({
      name: "domainId",
      type: Number,
      example: 1,
      description: "virtual_domains.id",
    }),
    ApiBody({
      schema: { example: { active: false } },
    }),
    ApiResponse({
      status: 200,
      description: "Domain updated",
      schema: {
        example: {
          id: 1,
          ownerId: 7,
          domain: "example.com",
          quota: "104857600",
          active: 0,
          userStartDate: "2026-01-01",
          userEndDate: null,
          lastActivity: "2026-07-04T12:00:00.000Z",
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "Body validation failed (active missing or not a boolean), or domainId is not a valid integer",
      schema: { example: { message: "Validation failed", issues: [] } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing permission admin:access or admin:modify for this domain",
    }),
    ApiResponse({
      status: 404,
      description: "Domain not found",
      schema: { example: { statusCode: 404, message: "Domain #1 not found" } },
    })
  );
