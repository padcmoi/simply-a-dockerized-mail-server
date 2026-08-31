import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocaleToProfiles1785107593722 implements MigrationInterface {
  name = "AddLocaleToProfiles1785107593722";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`account_profiles\` ADD COLUMN IF NOT EXISTS \`locale\` varchar(10) DEFAULT NULL AFTER \`presence_at\``
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`account_profiles\` DROP COLUMN \`locale\``);
  }
}
