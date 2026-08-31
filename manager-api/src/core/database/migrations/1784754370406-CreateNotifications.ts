import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotifications1784754370406 implements MigrationInterface {
  name = "CreateNotifications1784754370406";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`notifications\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`account_id\` char(36) NOT NULL,
        \`source\` varchar(32) NOT NULL,
        \`type\` varchar(64) NOT NULL,
        \`payload\` text DEFAULT NULL,
        \`link\` varchar(512) DEFAULT NULL,
        \`read_at\` datetime DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_notifications_account_id\` (\`account_id\`),
        KEY \`idx_notifications_account_read\` (\`account_id\`, \`read_at\`),
        CONSTRAINT \`fk_notifications_account_id\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`notification_preferences\` (
        \`account_id\` char(36) NOT NULL,
        \`source\` varchar(32) NOT NULL,
        \`in_app\` tinyint(1) NOT NULL DEFAULT 1,
        \`email\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`account_id\`, \`source\`),
        CONSTRAINT \`fk_notification_preferences_account_id\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`notification_preferences\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`notifications\``);
  }
}
