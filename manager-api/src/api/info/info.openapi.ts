import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const InfoApi = () => applyDecorators(ApiTags("info"));

export const GetInfoDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "What this deployment is",
      description:
        "The API root. Public and unauthenticated (no API key required), so the login screen can name the " +
        "running release before anyone has signed in. `code_version` is the `version` field of the API's own " +
        "package.json, read once at start-up.",
    }),
    ApiResponse({
      status: 200,
      description: "This deployment",
      schema: { example: { code_version: "2.0.0" } },
    })
  );
