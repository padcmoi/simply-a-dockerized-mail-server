import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const InfoApi = () => applyDecorators(ApiTags("info"));

export const GetInfoDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "What this deployment is",
      description:
        "The API root. Public and unauthenticated (no API key required), so the login screen can name the " +
        "running release before anyone has signed in. `code_version` is the last tag of the repository, " +
        "`git describe --tags --abbrev=0`, found by the entrypoint when the container starts and read once.",
    }),
    ApiResponse({
      status: 200,
      description: "This deployment",
      schema: { example: { code_version: "v2.0.0" } },
    })
  );
