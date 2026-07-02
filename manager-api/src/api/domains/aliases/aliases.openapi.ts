import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const AliasesApi = () =>
  applyDecorators(
    ApiTags("domain-aliases"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

export const ListAliasesDocs = () => applyDecorators(ApiOperation({ summary: "List aliases that belong to this domain" }));

export const GetAliasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Fetch an alias by id (must belong to this domain)",
    })
  );

export const CreateAliasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a source -> destination alias under this domain; body carries the local-part and the destination",
    })
  );

export const UpdateAliasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update destination / end-date of an alias in this domain",
    })
  );

export const RemoveAliasDocs = () => applyDecorators(ApiOperation({ summary: "Delete an alias from this domain" }));
