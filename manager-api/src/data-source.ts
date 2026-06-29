import { DataSource } from "typeorm";
import { Account } from "./accounts/account.entity";
import { RefreshToken } from "./auth/refresh-token.entity";
import { DkimKeyEntity } from "./dkim/dkim-key.entity";
import { VirtualDomain } from "./domains/virtual-domain.entity";
import { VirtualAlias } from "./aliases/virtual-alias.entity";
import { VirtualUser } from "./users/virtual-user.entity";
import { VirtualQuotaDomain } from "./quotas/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "./quotas/virtual-quota-user.entity";
import { SieveRejectSender } from "./sieve/sieve-reject-sender.entity";

// Stand-alone DataSource used exclusively by the TypeORM CLI (migration:generate,
// migration:run, migration:revert, migration:show). The Nest runtime keeps its
// own connection through TypeOrmModule.forRoot in app.module.ts. The two must
// stay in sync on driver + database + entities so generate diffs against the
// real schema. Run the CLI from inside the manager-api container so DB_* env
// vars are already injected by docker compose:
//   service.sh exec manager-api pnpm migrate:generate src/migrations/MyChange
export default new DataSource({
  type: "mariadb",
  host: process.env.DB_HOST ?? "mail-mariadb",
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  entities: [
    Account,
    RefreshToken,
    DkimKeyEntity,
    VirtualDomain,
    VirtualAlias,
    VirtualUser,
    VirtualQuotaDomain,
    VirtualQuotaUser,
    SieveRejectSender,
  ],
  migrations: ["src/migrations/*.ts"],
  migrationsTableName: "migrations",
});
