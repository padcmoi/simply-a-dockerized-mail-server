import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

export const RspamdApi = () => applyDecorators(ApiTags("rspamd"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const GetStatsDocs = () =>
  applyDecorators(ApiOperation({ summary: "Proxy Rspamd global stats (scanned, rejected, greylisted, clean)" }));
