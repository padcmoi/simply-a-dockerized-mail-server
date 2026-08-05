import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const ThemeApi = () => applyDecorators(ApiTags("theme"));

const example = {
  light: { primary: "#2B7FFF", "--ui-bg": "#FFFFFF" },
  dark: { primary: "#00C950", "--ui-bg": "#0F172B" },
};

const readExample = { tokens: { aliases: ["primary"], surfaces: ["--ui-bg"] }, ...example };

export const GetAppThemeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read the server-wide interface theme",
      description:
        "Public on purpose: the login screen is painted with it, and the interface's own server fetches it before " +
        "rendering the first page. An empty answer is the normal state of a fresh install and means the interface " +
        "keeps the colours it ships with. `tokens` is the catalogue the API validates against, so the form offers " +
        "exactly what it would accept.",
    }),
    ApiResponse({ status: 200, schema: { example: readExample } })
  );

export const UpdateAppThemeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Replace the server-wide interface theme (root only)",
      description:
        "A save replaces the whole theme: a colour left out goes back to the one the interface ships with, and an " +
        "empty body clears the table.",
    }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({
      status: 400,
      description: "Unknown token, or a value that is not a six digit hex colour",
      schema: { example: { statusCode: 400, message: "Validation failed", error: "Bad Request" } },
    }),
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetAccountThemeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read the signed-in account's own theme",
      description:
        "Laid over the server-wide theme at login. Empty means this account has chosen nothing and sees the server's " +
        "colours.",
    }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({ status: 401, description: "No valid access token" })
  );

export const UpdateAccountThemeDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Replace the signed-in account's own theme" }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({
      status: 400,
      description: "Unknown token, or a value that is not a six digit hex colour",
      schema: { example: { statusCode: 400, message: "Validation failed", error: "Bad Request" } },
    }),
    ApiResponse({ status: 401, description: "No valid access token" })
  );
