import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const MailCadenceApi = () => applyDecorators(ApiTags("config"));

const example = { offlineNotifyAfterMs: 300000, offlineSweepIntervalMs: 20000, mailMinIntervalMs: 30000 };

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetMailCadenceDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Read the email cadence settings (notification delay, sweep, per-recipient spool)" }),
    ApiResponse({ status: 200, schema: { example } }),
    RootOnly()
  );

export const UpdateMailCadenceDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Update the email cadence settings" }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({ status: 400, description: "A value is out of its allowed range" }),
    RootOnly()
  );
