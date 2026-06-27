import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AccountsModule } from './accounts/accounts.module'
import { AliasesModule } from './aliases/aliases.module'
import { AuthModule } from './auth/auth.module'
import { QuotaTriggersBootstrap } from './common/quota-triggers.bootstrap'
import { DomainsModule } from './domains/domains.module'
import { HealthModule } from './health/health.module'
import { QuotasModule } from './quotas/quotas.module'
import { SieveModule } from './sieve/sieve.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST ?? 'mail-mariadb',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
      charset: 'utf8_general_ci',
    }),
    HealthModule,
    AuthModule,
    AccountsModule,
    DomainsModule,
    UsersModule,
    AliasesModule,
    QuotasModule,
    SieveModule,
  ],
  providers: [QuotaTriggersBootstrap],
})
export class AppModule {}
