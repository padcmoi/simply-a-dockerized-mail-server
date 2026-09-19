import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { MAIL_LOG_SERVICES } from "./mail-logs.validation";

export const MailLogsApi = () => applyDecorators(ApiTags("mail-logs"), ApiSecurity("apiToken"));

export const ReadMailLogDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The last lines of the Postfix or Dovecot log",
      description:
        "Reads the log file from its end, oldest line first in the answer. `q` keeps the lines containing it, " +
        "ignoring case, and the search stops after 32 MB read, which `truncated` reports. A log that does not " +
        "exist yet answers an empty window. `start` is the byte offset of the oldest line returned: passing it back as " +
        "`before` reads the window just above, and 0 means the beginning of the file was reached.",
    }),
    ApiParam({ name: "service", enum: MAIL_LOG_SERVICES, description: "Which log to read" }),
    ApiQuery({ name: "lines", required: false, type: Number, description: "How many lines, 1 to 5000, 500 by default" }),
    ApiQuery({ name: "q", required: false, type: String, description: "Keep the lines containing this text" }),
    ApiQuery({ name: "before", required: false, type: Number, description: "Read the lines ending before this byte offset" }),
    ApiResponse({
      status: 200,
      description: "The window read from the end of the log.",
      schema: {
        example: {
          service: "postfix",
          lines: ["Sep 19 14:53:02 mail postfix/smtpd[412]: connect from mail.example.com[203.0.113.7]"],
          size: 6875188,
          start: 6818722,
          updatedAt: "2026-09-19T14:53:02.000Z",
          truncated: false,
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "Unknown service or invalid query",
      schema: { example: { statusCode: 400, message: "Unknown service", error: "Bad Request" } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing the `supervision:access` and/or `supervision:view-mail-logs` global permission",
      schema: { example: { statusCode: 403, message: "Missing permission supervision:access", error: "Forbidden" } },
    })
  );

export const DownloadMailLogDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The whole Postfix or Dovecot log file",
      description: "Streams the log file as it is on disk, with no line limit, as an attachment named after the service.",
    }),
    ApiParam({ name: "service", enum: MAIL_LOG_SERVICES, description: "Which log to download" }),
    ApiResponse({ status: 200, description: "The log file, text/plain." }),
    ApiResponse({
      status: 400,
      description: "Unknown service",
      schema: { example: { statusCode: 400, message: "Unknown service", error: "Bad Request" } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing the `supervision:access` and/or `supervision:view-mail-logs` global permission",
      schema: { example: { statusCode: 403, message: "Missing permission supervision:access", error: "Forbidden" } },
    }),
    ApiResponse({
      status: 404,
      description: "The log does not exist yet",
      schema: { example: { statusCode: 404, message: "No log yet", error: "Not Found" } },
    })
  );
