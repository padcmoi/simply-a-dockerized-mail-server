import { join } from "path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AliasesModule } from "./api/aliases/aliases.module";
import { DomainsModule } from "./api/domains/domains.module";
import { HealthModule } from "./api/health/health.module";
import { QuotasModule } from "./api/quotas/quotas.module";
import { RejectSendersModule } from "./api/sieve/reject-senders/reject-senders.module";
import { UsersModule } from "./api/users/users.module";
import { JwtAuthModule } from "./core/auth/jwt/jwt.module";

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
    HealthModule,
    JwtAuthModule,
    DomainsModule,
    UsersModule,
    AliasesModule,
    QuotasModule,
    RejectSendersModule,
  ],
})
export class AppModule {}
