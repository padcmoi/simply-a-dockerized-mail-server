import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const GeneralApi = () => applyDecorators(ApiTags("config"));

const example = { managerUrl: "https://mail-manager.example.com" };

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetGeneralDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Read the general server settings (public interface address)" }),
    ApiResponse({ status: 200, schema: { example } }),
    RootOnly()
  );

export const GetTldsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List the valid top-level domains used to validate the interface address" }),
    ApiResponse({ status: 200, schema: { example: { tlds: ["com", "ovh", "net"] } } }),
    RootOnly()
  );

export const UpdateGeneralDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Update the general server settings" }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({ status: 400, description: "The interface address is not an http(s) origin" }),
    RootOnly()
  );
