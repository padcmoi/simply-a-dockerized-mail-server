import type { MigrationInterface, QueryRunner } from "typeorm";

export class RenameEnLocaleToEnGb1785868557442 implements MigrationInterface {
  name = "RenameEnLocaleToEnGb1785868557442";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE \`account_profiles\` SET \`locale\` = 'en_GB' WHERE \`locale\` = 'en_EN'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE \`account_profiles\` SET \`locale\` = 'en_EN' WHERE \`locale\` = 'en_GB'`);
  }
}
