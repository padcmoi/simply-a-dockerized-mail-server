import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccountInvitations1782848575175 implements MigrationInterface {
  name = "CreateAccountInvitations1782848575175";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`account_invitations\` (
        \`id\`          int           NOT NULL AUTO_INCREMENT,
        \`token\`       varchar(128)  NOT NULL,
        \`email\`       varchar(255)  NOT NULL,
        \`invited_by\`  char(36)      DEFAULT NULL,
        \`domain_ids\`  json          DEFAULT NULL,
        \`accepted_at\` datetime      DEFAULT NULL,
        \`expires_at\`  datetime      NOT NULL,
        \`created_at\`  datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_invitation_token\` (\`token\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `account_invitations`");
  }
}
