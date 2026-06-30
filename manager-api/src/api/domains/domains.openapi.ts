import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

export const DomainsApi = () => applyDecorators(ApiTags("domains"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const ListDomainsDocs = () => applyDecorators(ApiOperation({ summary: "List managed domains" }));

export const DiskUsageDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Mail volume capacity (total / free / reserved by existing domains / still assignable)",
    })
  );

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
