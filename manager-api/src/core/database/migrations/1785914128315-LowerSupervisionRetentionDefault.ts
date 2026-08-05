import type { MigrationInterface, QueryRunner } from "typeorm";

export class LowerSupervisionRetentionDefault1785914128315 implements MigrationInterface {
  name = "LowerSupervisionRetentionDefault1785914128315";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`app_settings\` SET \`value\` = '604800000' WHERE \`key\` = 'supervision_retention_ms' AND \`value\` = '2592000000'`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`app_settings\` SET \`value\` = '2592000000' WHERE \`key\` = 'supervision_retention_ms' AND \`value\` = '604800000'`
    );
  }
}
