import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const PostfixApi = () => applyDecorators(ApiTags("postfix"), ApiSecurity("apiToken"));

export const GetQueueDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Postfix queue stats (active, deferred, hold, incoming), optionally filtered by domain",
      description:
        "Counts the files sitting in each postfix spool queue directory. When `domain` is supplied, an additional " +
        "`domain` breakdown is returned, counting only queued messages whose contents reference `@<domain>`. " +
        "If the spool directory cannot be read (e.g. it is not mounted into this container), the endpoint still " +
        "answers 200 but with `available: false` and every count at 0; it never throws for this condition.",
    }),
    ApiQuery({
      name: "domain",
      required: false,
      type: String,
      example: "example.com",
      description: "Restrict the returned `domain` breakdown to this FQDN (matches `@<domain>` inside queued message files)",
    }),
    ApiResponse({
      status: 200,
      description:
        "Queue stats. `domain` is only present when the `domain` query param was given. `available` is `false` " +
        "(with all counts at 0) when the postfix spool directories could not be read.",
      schema: {
        example: {
          total: { active: 3, deferred: 1, hold: 0, incoming: 0 },
          domain: { active: 1, deferred: 0, hold: 0, incoming: 0 },
          available: true,
        },
      },
    }),
    ApiResponse({
      status: 403,
      description:
        "Missing the `postfix:access` and/or `postfix:view-postfix-queue` global permission (the message names whichever is missing first)",
      schema: {
        example: { statusCode: 403, message: "Missing permission postfix:access", error: "Forbidden" },
      },
    })
  );
