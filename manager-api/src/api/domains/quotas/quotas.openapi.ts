import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const QuotasApi = () =>
  applyDecorators(
    ApiTags("domain-quotas"),
    ApiSecurity("apiToken"),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

export const GetDomainQuotasDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Live quota snapshot for this domain: aggregate counters + per-recipient counters from dovecot",
    })
  );
