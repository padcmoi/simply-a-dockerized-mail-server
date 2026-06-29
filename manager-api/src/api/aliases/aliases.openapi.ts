import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

export const AliasesApi = () => applyDecorators(ApiTags("aliases"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const ListAliasesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List aliases (optionally filtered by domain)" }),
    ApiQuery({ name: "domain", required: false, type: String })
  );

export const GetAliasDocs = () => applyDecorators(ApiOperation({ summary: "Fetch an alias by id" }));

export const CreateAliasDocs = () =>
  applyDecorators(ApiOperation({ summary: "Create a source -> destination alias on an existing domain" }));

export const UpdateAliasDocs = () => applyDecorators(ApiOperation({ summary: "Update the destination / end-date of an alias" }));

export const RemoveAliasDocs = () => applyDecorators(ApiOperation({ summary: "Delete an alias" }));
