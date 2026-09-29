import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const PostfixConfigApi = () => applyDecorators(ApiTags("config"));

const settings = {
  bounceSenderLocal: "mailer-daemon",
  bounceSenderDomain: "example.com",
  delayWarningHours: 4,
  maximalQueueLifetimeDays: 3,
};

const view = {
  settings,
  version: 2,
  hostname: "mail.example.com",
  domains: ["example.com", "example.org"],
  status: {
    state: "applied",
    appliedVersion: 2,
    appliedAt: "2026-09-29T10:00:00Z",
    checkedAt: "2026-09-29T10:00:00Z",
    error: null,
  },
};

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetPostfixConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read the Postfix settings managed from here, and whether Postfix has applied them",
      description:
        "`settings` holds only the allowed settings. `bounceSenderDomain` empty keeps the default sender, mailer-daemon at `hostname`. " +
        "`domains` are the active hosted domains the sender may use. `version` grows with every change. `status.state` is `applied` when " +
        "Postfix runs this version, `pending` while it has not read it yet, `error` when it refused it (then `status.error` holds why and " +
        "the previous version stays in force) and `unknown` when Postfix has never reported.",
    }),
    ApiResponse({ status: 200, schema: { example: view } }),
    RootOnly()
  );

export const UpdatePostfixConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update the Postfix settings managed from here",
      description:
        "Every field is required. `bounceSenderLocal` is 1 to 64 of `a-z 0-9 . _ -`; `bounceSenderDomain` is empty or an active hosted " +
        "domain; `delayWarningHours` is 0 (no warning) to 24 and must stay below " +
        "`maximalQueueLifetimeDays` (1 to 5) in hours. Postfix revalidates the whole set, applies it all or nothing and reloads without " +
        "dropping a connection. Recorded in the activity journal when something changed.",
    }),
    ApiBody({ schema: { example: settings } }),
    ApiResponse({ status: 200, schema: { example: view } }),
    ApiResponse({
      status: 400,
      description: "A value is out of its allowed range, or the domain is not an active hosted domain",
    }),
    RootOnly()
  );
