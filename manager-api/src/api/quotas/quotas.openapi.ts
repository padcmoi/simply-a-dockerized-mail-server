import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

export const QuotasApi = () => applyDecorators(ApiTags("quotas"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const ListDomainQuotasDocs = () =>
  applyDecorators(ApiOperation({ summary: "Per-domain quota counters (bytes + messages, live from dovecot)" }));

export const ListUserQuotasDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Per-user quota counters, optionally filtered by domain" }),
    ApiQuery({ name: "domain", required: false, type: String })
  );
