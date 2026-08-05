import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const SupervisionRetentionApi = () => applyDecorators(ApiTags("config"));

const example = { supervisionRetentionMs: 604800000 };

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetSupervisionRetentionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read how long the recorded machine history is kept",
      description:
        "One row of `metrics_history` stands for ten seconds, so a day of history is about 8 640 rows. The purge " +
        "runs once at boot and then hourly, and reads this value on every pass: a change applies to the next purge, " +
        "not at the next restart.",
    }),
    ApiResponse({ status: 200, schema: { example } }),
    RootOnly()
  );

export const UpdateSupervisionRetentionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Change how long the recorded machine history is kept (one day to one year)" }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({
      status: 400,
      description: "Shorter than a day or longer than a year",
      schema: { example: { statusCode: 400, message: "Validation failed", error: "Bad Request" } },
    }),
    RootOnly()
  );
