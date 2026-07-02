import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const PostfixApi = () => applyDecorators(ApiTags("postfix"), ApiSecurity("apiToken"));

export const GetQueueDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Postfix queue stats (active, deferred, hold, incoming), optionally filtered by domain",
    }),
    ApiQuery({
      name: "domain",
      required: false,
      description: "Filter queue counts to this FQDN",
    })
  );
