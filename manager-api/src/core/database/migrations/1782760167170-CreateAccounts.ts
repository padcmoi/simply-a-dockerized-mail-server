import type { MigrationInterface, QueryRunner } from "typeorm";

// manager-api auth surface: `accounts` (admin users that log into the UI)
// + `refresh_tokens` (per-session JWT refresh material with FK CASCADE on
// account removal). Independent of the mail-routing data above.
export class CreateAccounts1782760167170 implements MigrationInterface {
  name = "CreateAccounts1782760167170";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`accounts\` (
        \`id\` char(36) NOT NULL,
        \`username\` varchar(255) NOT NULL,
        \`password\` varchar(255) DEFAULT NULL,
        \`role\` varchar(32) NOT NULL DEFAULT 'admin',
        \`enabled\` tinyint(1) NOT NULL DEFAULT 1,
        \`last_login\` datetime DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_accounts_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`refresh_tokens\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`account_id\` char(36) NOT NULL,
        \`token_hash\` varchar(255) NOT NULL,
        \`user_agent\` varchar(255) DEFAULT NULL,
        \`ip\` varchar(45) DEFAULT NULL,
        \`expires_at\` datetime NOT NULL,
        \`revoked_at\` datetime DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_refresh_tokens_token_hash\` (\`token_hash\`),
        KEY \`idx_refresh_tokens_account_id\` (\`account_id\`),
        CONSTRAINT \`fk_refresh_tokens_account_id\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `refresh_tokens`");
    await queryRunner.query("DROP TABLE IF EXISTS `accounts`");
  }
}
