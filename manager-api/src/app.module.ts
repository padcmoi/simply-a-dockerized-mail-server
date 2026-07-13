import { join } from "path";
import { APP_GUARD } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountsModule } from "./api/accounts/accounts.module";
import { DomainsModule } from "./api/domains/domains.module";
import { GroupsModule } from "./api/groups/groups.module";
import { HealthModule } from "./api/health/health.module";
import { PostfixModule } from "./api/postfix/postfix.module";
import { RspamdModule } from "./api/rspamd/rspamd.module";
import { RejectSendersModule } from "./api/sieve/reject-senders/reject-senders.module";
import { ApiTokenModule } from "./core/auth/api-token/api-token.module";
import { CombinedAuthGuard } from "./core/auth/auth.guard";
import { JwtAuthModule } from "./core/auth/jwt/jwt.module";
import { CustomPermissionGuardModule } from "./core/custom-permission-guard/custom-permission-guard.module";
import { RefreshToken } from "./core/entities/refresh-token.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "mariadb",
      host: process.env.DB_HOST ?? "mail-mariadb",
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: false,
      migrations: [join(__dirname, "core/database/migrations", "*.js")],
      migrationsRun: true,
      migrationsTableName: "migrations",
      charset: "utf8mb4",
    }),
    // The global CombinedAuthGuard checks the session behind each access token.
    TypeOrmModule.forFeature([RefreshToken]),
    HealthModule,
    JwtAuthModule,
    ApiTokenModule,
    CustomPermissionGuardModule,
    DomainsModule,
    RejectSendersModule,
    AccountsModule,
    GroupsModule,
    RspamdModule,
    PostfixModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CombinedAuthGuard }],
})
export class AppModule {}
