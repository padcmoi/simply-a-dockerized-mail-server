import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

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

export const GetQueueMessagesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The messages sitting in one Postfix queue, read from the spool",
      description:
        "Reads the queue files of `queue` (active, deferred, hold or incoming) from the spool mounted read-only, newest first, " +
        "at most `limit` of them; `total` counts them all. Each message gives its queue id, arrival time, size in bytes, " +
        "envelope sender (empty for a notification, the null sender) and the recipients still pending, each with the status " +
        "and the reason of its last failed attempt when Postfix logged one. The websocket topic `postfix-queue-messages:<queue>` " +
        "pushes the same view whenever it changes. `available` is `false` when the spool cannot be read.",
    }),
    ApiParam({ name: "queue", enum: ["active", "deferred", "hold", "incoming"] }),
    ApiResponse({
      status: 200,
      schema: {
        example: {
          queue: "deferred",
          total: 1,
          limit: 500,
          available: true,
          messages: [
            {
              id: "60CD226AED9",
              arrivalTime: "2026-09-29T13:29:15.000Z",
              size: 353,
              sender: "someone@example.com",
              recipients: [
                {
                  address: "user@example.org",
                  status: "4.4.1",
                  reason: "connect to mx.example.org[192.0.2.1]:25: Connection timed out",
                },
              ],
            },
          ],
        },
      },
    }),
    ApiResponse({ status: 400, description: "Unknown queue" }),
    ApiResponse({
      status: 403,
      description:
        "Missing the `postfix:access` and/or `postfix:view-postfix-queue` global permission (the message names whichever is missing first)",
    })
  );

export const PurgeQueueMessageDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Purge one message from a Postfix queue",
      description:
        "Deletes the message `id` from `queue` for good, as `postsuper -d` would, without any notification to its sender. " +
        "manager-api never runs a Postfix command: it drops the command in the directory shared with the Postfix container, " +
        "whose watcher revalidates it and runs it, then waits up to 10 seconds for the answer. Recorded in the activity journal.",
    }),
    ApiParam({ name: "queue", enum: ["active", "deferred", "hold", "incoming"] }),
    ApiParam({ name: "id", example: "60CD226AED9", description: "Postfix queue id, 6 to 32 letters and digits" }),
    ApiResponse({ status: 204, description: "Purged" }),
    ApiResponse({ status: 400, description: "Unknown queue or malformed queue id" }),
    ApiResponse({
      status: 403,
      description: "Missing the `postfix:access` and/or `postfix:purge-postfix-queue-message` global permission",
    }),
    ApiResponse({ status: 404, description: "The message is not, or no longer, in that queue" }),
    ApiResponse({ status: 503, description: "Postfix did not answer the command in time" })
  );
