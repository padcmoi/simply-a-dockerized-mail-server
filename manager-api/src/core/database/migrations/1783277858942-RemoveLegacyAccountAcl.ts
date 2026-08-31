import type { MigrationInterface, QueryRunner } from "typeorm";

// Removes the legacy, now-superseded per-account domain ACL system that
// predates the group-based model (see ReworkAclModel1783277858895 and
// .trash/ACLs/acls.md):
//  - `account_domain_acl` is dropped outright -- access is now expressed via
//    `accounts.group_id` + `group_domain_permissions`;
//  - `account_invitations.domain_ids` is replaced by `group_id`, a nullable
//    FK to `groups.id` (ON DELETE SET NULL) so an invitation can target the
//    group the invitee will land in once they accept (falling back to
//    whichever group is `is_default`, resolved at invite-time by the
//    service, or NULL for zero permissions).
export class RemoveLegacyAccountAcl1783277858942 implements MigrationInterface {
  name = "RemoveLegacyAccountAcl1783277858942";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `account_domain_acl`");

    await queryRunner.query("ALTER TABLE `account_invitations` DROP COLUMN `domain_ids`");
    await queryRunner.query(`
      ALTER TABLE \`account_invitations\`
        ADD COLUMN \`group_id\` char(36) NULL AFTER \`invited_by\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`account_invitations\`
        ADD CONSTRAINT \`fk_account_invitations_group\`
        FOREIGN KEY (\`group_id\`) REFERENCES \`groups\` (\`id\`) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` DROP FOREIGN KEY `fk_account_invitations_group`");
    await queryRunner.query("ALTER TABLE `account_invitations` DROP COLUMN `group_id`");
    await queryRunner.query(`
      ALTER TABLE \`account_invitations\`
        ADD COLUMN \`domain_ids\` json NULL AFTER \`invited_by\`
    `);

    await queryRunner.query(`
      CREATE TABLE \`account_domain_acl\` (
        \`id\`          int      NOT NULL AUTO_INCREMENT,
        \`account_id\`  char(36) NOT NULL,
        \`domain_id\`   int      NOT NULL,
        \`created_at\`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_acl_account_domain\` (\`account_id\`, \`domain_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}
