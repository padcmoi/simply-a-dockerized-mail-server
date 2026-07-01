import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

export const SpamdApi = () => applyDecorators(ApiTags("domains"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const GetDomainSpamdHistoryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Rspamd scan history filtered to this domain's recipients" }),
    ApiQuery({ name: "size", required: false, description: "Max rows (default 200)" })
  );

export const GetDomainSpamdStatsDocs = () =>
  applyDecorators(ApiOperation({ summary: "Rspamd stats computed from this domain's scan history" }));
