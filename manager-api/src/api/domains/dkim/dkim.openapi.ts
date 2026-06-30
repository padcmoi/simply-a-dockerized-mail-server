import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

export const DkimApi = () =>
  applyDecorators(
    ApiTags("domain-dkim"),
    ApiBearerAuth(),
    UseGuards(AuthGuard("jwt")),
    ApiParam({ name: "domainId", type: Number, description: "Parent virtual_domains.id" })
  );

export const ListDkimDocs = () => applyDecorators(ApiOperation({ summary: "List active DKIM selectors for this domain" }));

export const RotateDkimDocs = () =>
  applyDecorators(ApiOperation({ summary: "Generate a fresh DKIM selector for this domain without removing the previous one" }));

export const RemoveDkimDocs = () =>
  applyDecorators(ApiOperation({ summary: "Remove a specific DKIM selector for this domain (after its TTL expired)" }));
