import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateApiTokens1782985738424 implements MigrationInterface {
  name = "CreateApiTokens1782985738424";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`api_tokens\` (
        \`id\`              int          NOT NULL AUTO_INCREMENT,
        \`account_id\`      char(36)     NOT NULL,
        \`name\`            varchar(255) NOT NULL,
        \`client_id\`       varchar(64)  NOT NULL,
        \`secret_hash\`     varchar(255) NOT NULL,
        \`allowed_ips\`     text         NULL,
        \`expires_at\`      datetime     NULL,
        \`failed_attempts\` int          NOT NULL DEFAULT 0,
        \`locked_until\`    datetime     NULL,
        \`last_used_at\`    datetime     NULL,
        \`last_used_ip\`    varchar(45)  NULL,
        \`created_at\`      datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_api_tokens_client_id\` (\`client_id\`),
        CONSTRAINT \`fk_api_tokens_account\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `api_tokens`");
  }
}
