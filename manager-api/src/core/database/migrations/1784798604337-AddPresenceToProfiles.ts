import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPresenceToProfiles1784798604337 implements MigrationInterface {
  name = "AddPresenceToProfiles1784798604337";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`account_profiles\`
        ADD COLUMN \`presence\` tinyint(1) NOT NULL DEFAULT 0 AFTER \`account_id\`,
        ADD COLUMN \`presence_at\` datetime DEFAULT NULL AFTER \`presence\`,
        ADD KEY \`idx_account_profiles_presence\` (\`presence\`)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`account_profiles\` DROP KEY \`idx_account_profiles_presence\`, DROP COLUMN \`presence_at\`, DROP COLUMN \`presence\``
    );
  }
}
