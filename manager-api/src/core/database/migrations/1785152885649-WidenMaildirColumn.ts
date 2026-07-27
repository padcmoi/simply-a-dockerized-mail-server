import type { MigrationInterface, QueryRunner } from "typeorm";

export class WidenMaildirColumn1785152885649 implements MigrationInterface {
  name = "WidenMaildirColumn1785152885649";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_users\` MODIFY COLUMN \`maildir\` varchar(255) NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_users\` MODIFY COLUMN \`maildir\` char(50) NOT NULL`);
  }
}
