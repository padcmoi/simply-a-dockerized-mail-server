import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

export const PostfixApi = () => applyDecorators(ApiTags("postfix"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const GetQueueDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Postfix queue stats (active, deferred, hold, incoming), optionally filtered by domain" }),
    ApiQuery({ name: "domain", required: false, description: "Filter queue counts to this FQDN" })
  );
