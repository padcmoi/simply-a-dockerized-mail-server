import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const SpamdApi = () => applyDecorators(ApiTags("domains"), ApiSecurity("apiToken"));

export const GetDomainSpamdHistoryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Rspamd scan history filtered to this domain's recipients" }),
    ApiQuery({ name: "size", required: false, description: "Max rows (default 200)" })
  );

export const GetDomainSpamdStatsDocs = () =>
  applyDecorators(ApiOperation({ summary: "Rspamd stats computed from this domain's scan history" }));
