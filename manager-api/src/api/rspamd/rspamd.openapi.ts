import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

export const RspamdApi = () => applyDecorators(ApiTags("rspamd"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const GetStatsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Proxy Rspamd global stats (scanned, rejected, greylisted, clean)",
    })
  );

export const GetHistoryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Rspamd scan history, optionally filtered by recipient domain",
    }),
    ApiQuery({
      name: "domain",
      required: false,
      description: "Filter to recipients of this FQDN",
    }),
    ApiQuery({
      name: "size",
      required: false,
      description: "Max rows (default 200)",
    })
  );
