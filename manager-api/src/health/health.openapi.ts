import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const OpenApiHealthCheck = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liveness probe + MariaDB connectivity ping',
      description: 'Throttled to 30 hits / minute. Used by docker healthchecks and uptime probes.',
    }),
    ApiOkResponse({ description: '{ status: "ok", info: { mariadb: { status: "up" } }, ... }' }),
  );
