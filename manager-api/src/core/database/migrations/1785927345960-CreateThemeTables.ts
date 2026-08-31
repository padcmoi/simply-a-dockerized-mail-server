import type { MigrationInterface, QueryRunner } from "typeorm";

// Both tables ship empty and are meant to stay that way until someone changes a
// colour. No seed: the interface's own default is already written in the front,
// and a seeded row would be a copy of it, wrong the day it moves and
// indistinguishable from a deliberate choice. Absence is the fallback.
// The collation is spelled out rather than left to the schema default: the
// account foreign key only forms if both columns collate the same way, and
// `accounts` is utf8mb4_unicode_ci.
export class CreateThemeTables1785927345960 implements MigrationInterface {
  name = "CreateThemeTables1785927345960";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_themes\` (
        \`key\` varchar(64) NOT NULL,
        \`type_field\` enum('number','string') NOT NULL DEFAULT 'string',
        \`mode\` enum('dark','light') NOT NULL,
        \`value\` varchar(512) NOT NULL DEFAULT '',
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`key\`, \`mode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`account_themes\` (
        \`account_id\` char(36) NOT NULL,
        \`key\` varchar(64) NOT NULL,
        \`type_field\` enum('number','string') NOT NULL DEFAULT 'string',
        \`mode\` enum('dark','light') NOT NULL,
        \`value\` varchar(512) NOT NULL DEFAULT '',
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`account_id\`, \`key\`, \`mode\`),
        CONSTRAINT \`FK_account_themes_account\` FOREIGN KEY (\`account_id\`)
          REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `account_themes`");
    await queryRunner.query("DROP TABLE IF EXISTS `app_themes`");
  }
}
