import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

export const QuotasApi = () =>
  applyDecorators(
    ApiTags("domain-quotas"),
    ApiBearerAuth(),
    UseGuards(AuthGuard("jwt")),
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
