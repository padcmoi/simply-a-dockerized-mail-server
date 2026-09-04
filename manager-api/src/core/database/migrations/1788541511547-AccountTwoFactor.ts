import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountTwoFactor1788541511547 implements MigrationInterface {
  name = "AccountTwoFactor1788541511547";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`account_two_factor\` (
        \`account_id\` char(36) NOT NULL,
        \`secret_cipher\` varchar(512) NOT NULL,
        \`enabled_at\` datetime NULL,
        \`last_used_step\` bigint NULL,
        \`recovery_codes\` json NOT NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`account_id\`),
        CONSTRAINT \`fk_account_two_factor_account_id\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`account_two_factor\``);
  }
}
