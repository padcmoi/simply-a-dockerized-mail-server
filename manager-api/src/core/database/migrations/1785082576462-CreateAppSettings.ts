import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAppSettings1785082576462 implements MigrationInterface {
  name = "CreateAppSettings1785082576462";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_settings\` (
        \`key\` varchar(64) NOT NULL,
        \`type_field\` enum('number','string') NOT NULL,
        \`value\` varchar(512) NOT NULL DEFAULT '',
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO \`app_settings\` (\`key\`, \`type_field\`, \`value\`) VALUES
        ('offline_notify_after_ms', 'number', '300000'),
        ('offline_sweep_interval_ms', 'number', '20000'),
        ('mail_min_interval_ms', 'number', '30000'),
        ('manager_url', 'string', '')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `app_settings`");
  }
}
