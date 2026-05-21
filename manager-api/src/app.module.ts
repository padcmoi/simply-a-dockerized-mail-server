import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InfraModule } from './infra/infra.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { DomainsModule } from './domains/domains.module';
import { UsersModule } from './users/users.module';
import { AliasesModule } from './aliases/aliases.module';
import { AccountsModule } from './accounts/accounts.module';
import { QuotasModule } from './quotas/quotas.module';
import { SieveModule } from './sieve/sieve.module';
import { WebadminAccountsModule } from './webadmin-accounts/webadmin-accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
          limit: Number(process.env.THROTTLE_LIMIT ?? 100),
        },
      ],
    }),
    DatabaseModule,
    AuthModule,
    CommonModule,
    HealthModule,
    InfraModule,
    DomainsModule,
    UsersModule,
    AliasesModule,
    AccountsModule,
    QuotasModule,
    SieveModule,
    WebadminAccountsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
