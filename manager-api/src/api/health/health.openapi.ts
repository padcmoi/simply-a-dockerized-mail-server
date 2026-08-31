import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const HealthApi = () => applyDecorators(ApiTags("health"));

export const HealthStatusDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Liveness + identity probe",
      description:
        "Public, unauthenticated endpoint (no API key required). Reports whether the manager-api process itself " +
        "is up, plus a best-effort snapshot of DB, Redis and postfix reachability and host CPU/memory pressure. " +
        "`status` is `down` only when the database is unreachable, `degraded` when redis/postfix are down or " +
        "load is high, and `ok` otherwise. This endpoint always returns 200 if the process is running at all.",
    }),
    ApiResponse({
      status: 200,
      description: "Service is up; see `healthcheck` for the underlying component statuses",
      schema: {
        example: {
          healthcheck: {
            status: "ok",
            cpu: "low",
            memory: "medium",
            redis: "ok",
            db: "ok",
            cpuPercent: 12,
            memoryPercent: 61,
            loadScore: 8,
            charge: "low",
            loadSignal: "up 92%",
          },
        },
      },
    })
  );
