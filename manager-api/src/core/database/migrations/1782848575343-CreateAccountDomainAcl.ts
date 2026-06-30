import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccountDomainAcl1782848575343 implements MigrationInterface {
  name = "CreateAccountDomainAcl1782848575343";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`account_domain_acl\` (
        \`id\`          int      NOT NULL AUTO_INCREMENT,
        \`account_id\`  int      NOT NULL,
        \`domain_id\`   int      NOT NULL,
        \`created_at\`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_acl_account_domain\` (\`account_id\`, \`domain_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `account_domain_acl`");
  }
}
