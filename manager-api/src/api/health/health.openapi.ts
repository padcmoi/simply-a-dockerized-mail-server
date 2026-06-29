import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const HealthApi = () => applyDecorators(ApiTags("health"));

export const HealthStatusDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Liveness + identity probe" }),
    ApiResponse({ status: 200, description: "Service is up" })
  );
