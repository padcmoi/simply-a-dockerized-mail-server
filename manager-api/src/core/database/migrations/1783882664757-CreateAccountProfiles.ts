import type { MigrationInterface, QueryRunner } from "typeorm";

// Separates every personal / non-auth attribute of an account into its own
// one-to-one table, so `accounts` stays strictly authentication material. On a
// fresh install this runs against an empty `accounts` table (the root row is
// seeded by install.sh only afterwards), so the backfill below is a no-op there;
// it exists so an in-place upgrade still gives every existing account a profile.
export class CreateAccountProfiles1783882664757 implements MigrationInterface {
  name = "CreateAccountProfiles1783882664757";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`account_profiles\` (
        \`account_id\` char(36) NOT NULL,
        \`display_name\` varchar(255) DEFAULT NULL,
        \`avatar_url\` varchar(1024) DEFAULT NULL,
        \`phone\` varchar(32) DEFAULT NULL,
        \`address_line\` varchar(255) DEFAULT NULL,
        \`city\` varchar(255) DEFAULT NULL,
        \`postal_code\` varchar(32) DEFAULT NULL,
        \`country\` varchar(255) DEFAULT NULL,
        \`latitude\` decimal(10,7) DEFAULT NULL,
        \`longitude\` decimal(10,7) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`account_id\`),
        CONSTRAINT \`fk_account_profiles_account_id\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Carry the display fields that still live on `accounts` today (name,
    // avatar_url); a later step moves them off `accounts` entirely. Copy, not
    // move, for now, so the app keeps working between the two steps.
    await queryRunner.query(`
      INSERT INTO \`account_profiles\` (account_id, display_name, avatar_url, created_at, updated_at)
      SELECT id, name, avatar_url, NOW(), NOW() FROM \`accounts\`
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `account_profiles`");
  }
}
