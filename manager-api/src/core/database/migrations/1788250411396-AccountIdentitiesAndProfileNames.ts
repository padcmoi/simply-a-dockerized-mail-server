import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountIdentitiesAndProfileNames1788250411396 implements MigrationInterface {
  name = "AccountIdentitiesAndProfileNames1788250411396";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`account_identities\` (
        \`id\` char(36) NOT NULL,
        \`account_id\` char(36) NOT NULL,
        \`provider\` varchar(32) NOT NULL,
        \`subject\` varchar(255) NOT NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_account_identities_provider_subject\` (\`provider\`, \`subject\`),
        INDEX \`idx_account_identities_account_id\` (\`account_id\`),
        CONSTRAINT \`fk_account_identities_account_id\` FOREIGN KEY (\`account_id\`)
          REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`ALTER TABLE \`account_profiles\` ADD \`first_name\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`account_profiles\` ADD \`last_name\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`account_profiles\` ADD \`gender\` varchar(16) NULL`);
    // The existing display names are split rather than dropped: the first word
    // becomes the first name and the rest the last name, a lone word landing on
    // the first name. down() recomposes them, so the pair survives a round trip.
    await queryRunner.query(`
      UPDATE \`account_profiles\`
      SET
        \`first_name\` = CASE
          WHEN \`display_name\` IS NULL OR TRIM(\`display_name\`) = '' THEN NULL
          WHEN INSTR(TRIM(\`display_name\`), ' ') = 0 THEN TRIM(\`display_name\`)
          ELSE SUBSTRING_INDEX(TRIM(\`display_name\`), ' ', 1)
        END,
        \`last_name\` = CASE
          WHEN \`display_name\` IS NULL OR TRIM(\`display_name\`) = '' THEN NULL
          WHEN INSTR(TRIM(\`display_name\`), ' ') = 0 THEN NULL
          ELSE NULLIF(TRIM(SUBSTRING(TRIM(\`display_name\`), INSTR(TRIM(\`display_name\`), ' ') + 1)), '')
        END
    `);
    await queryRunner.query(`ALTER TABLE \`account_profiles\` DROP COLUMN \`display_name\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`account_profiles\` ADD \`display_name\` varchar(255) NULL`);
    await queryRunner.query(`
      UPDATE \`account_profiles\`
      SET \`display_name\` = NULLIF(TRIM(CONCAT_WS(' ', \`first_name\`, \`last_name\`)), '')
    `);
    await queryRunner.query(`ALTER TABLE \`account_profiles\` DROP COLUMN \`gender\``);
    await queryRunner.query(`ALTER TABLE \`account_profiles\` DROP COLUMN \`last_name\``);
    await queryRunner.query(`ALTER TABLE \`account_profiles\` DROP COLUMN \`first_name\``);
    await queryRunner.query(`DROP TABLE \`account_identities\``);
  }
}
