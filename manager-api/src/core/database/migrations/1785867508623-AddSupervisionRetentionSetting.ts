import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupervisionRetentionSetting1785867508623 implements MigrationInterface {
  name = "AddSupervisionRetentionSetting1785867508623";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Thirty days, the default the recorder falls back to when the row is
    // missing: seeded here so the value an operator reads in the settings page
    // is the one that is actually applied.
    await queryRunner.query(`
      INSERT IGNORE INTO \`app_settings\` (\`key\`, \`type_field\`, \`value\`) VALUES
        ('supervision_retention_ms', 'number', '2592000000')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM `app_settings` WHERE `key` = 'supervision_retention_ms'");
  }
}
