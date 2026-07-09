import type { MigrationInterface, QueryRunner } from "typeorm";

// An account can now belong to zero, one, or several groups. Replaces the
// scalar `accounts.group_id` (introduced by 1783277858895-ReworkAclModel)
// with a join table -- essentially reintroducing the `group_members` table
// that same migration had dropped in favor of the scalar column.
export class AccountGroupsManyToMany1783362780711 implements MigrationInterface {
  name = "AccountGroupsManyToMany1783362780711";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`group_members\` (
        \`id\`         int      NOT NULL AUTO_INCREMENT,
        \`group_id\`   char(36) NOT NULL,
        \`account_id\` char(36) NOT NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_group_members_group_account\` (\`group_id\`, \`account_id\`),
        CONSTRAINT \`fk_group_members_group\`
          FOREIGN KEY (\`group_id\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_group_members_account\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT INTO \`group_members\` (\`group_id\`, \`account_id\`, \`created_at\`)
      SELECT \`group_id\`, \`id\`, NOW() FROM \`accounts\` WHERE \`group_id\` IS NOT NULL
    `);

    await queryRunner.query("ALTER TABLE `accounts` DROP FOREIGN KEY `fk_accounts_group`");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `group_id`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`accounts\`
        ADD COLUMN \`group_id\` char(36) NULL AFTER \`is_root\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`accounts\`
        ADD CONSTRAINT \`fk_accounts_group\`
        FOREIGN KEY (\`group_id\`) REFERENCES \`groups\` (\`id\`) ON DELETE SET NULL
    `);

    // Lossy on purpose: a scalar column can only hold one group per account,
    // so an account with several memberships keeps only its lowest group id.
    await queryRunner.query(`
      UPDATE \`accounts\` a
      SET \`group_id\` = (
        SELECT MIN(gm.\`group_id\`) FROM \`group_members\` gm WHERE gm.\`account_id\` = a.\`id\`
      )
    `);

    await queryRunner.query("DROP TABLE `group_members`");
  }
}
