import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFail2banHistory1789841562904 implements MigrationInterface {
  name = "CreateFail2banHistory1789841562904";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`fail2ban_history\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`at\` bigint NOT NULL,
        \`jail\` varchar(64) NOT NULL,
        \`banned\` double NOT NULL,
        INDEX \`idx_fail2ban_history_at\` (\`at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`fail2ban_history\``);
  }
}
