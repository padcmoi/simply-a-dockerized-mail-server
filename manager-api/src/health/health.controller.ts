import { Controller, Get, Version } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Version('1')
  @HealthCheck()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  check() {
    return this.health.check([() => this.db.pingCheck('mariadb', { timeout: 1500 })]);
  }
}
