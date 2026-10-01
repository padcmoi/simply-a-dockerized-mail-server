import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const AlertApi = () => applyDecorators(ApiTags("config"));

const example = { adminAlertEmail: "admin@example.com" };

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetAlertDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read the address to alert when the server has a problem",
      description: "Empty when none is set. Read by the scripts of the host, the backup among them, to warn an administrator.",
    }),
    ApiResponse({ status: 200, schema: { example } }),
    RootOnly()
  );

export const UpdateAlertDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Set the address to alert when the server has a problem",
      description: "A valid email address, stored in lower case, or an empty string to alert nobody.",
    }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({ status: 400, description: "Neither a valid email address nor empty" }),
    RootOnly()
  );
