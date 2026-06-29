import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

export const DomainsApi = () => applyDecorators(ApiTags("domains"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const ListDomainsDocs = () => applyDecorators(ApiOperation({ summary: "List managed domains" }));

export const GetDomainDocs = () => applyDecorators(ApiOperation({ summary: "Fetch a domain by id" }));

export const CreateDomainDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a managed domain (reserves postmaster, provisions DKIM key best-effort)",
    })
  );

export const UpdateDomainDocs = () =>
  applyDecorators(ApiOperation({ summary: "Update quota / active flag / owner / end-date of a domain" }));

export const RemoveDomainDocs = () =>
  applyDecorators(ApiOperation({ summary: "Delete a domain (cascades users, aliases, quota rows, DKIM keys)" }));

export const ListDkimDocs = () => applyDecorators(ApiOperation({ summary: "List active DKIM selectors for a domain" }));

export const RotateDkimDocs = () =>
  applyDecorators(ApiOperation({ summary: "Generate a fresh DKIM selector without removing the previous one" }));

export const RemoveDkimDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Remove a specific DKIM selector for a domain (after TTL has expired)" }),
    ApiQuery({ name: "selector", required: true, type: String })
  );
