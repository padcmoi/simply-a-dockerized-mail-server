import type { MigrationInterface, QueryRunner } from "typeorm";

// Reworks the first-pass ACL schema from 1783277858579-CreateGroupsAndPermissions
// to match the recovered ACL design docs (.trash/ACLs/acls.md and friends):
//  - an account belongs to zero or one group (`accounts.group_id`), replacing
//    the many-to-many `group_members` join table;
//  - `groups.is_default` marks the group new invitees fall back to; "only one
//    default at a time" is enforced at the service level (see GroupsService),
//    not a DB constraint -- MariaDB partial unique indexes aren't reliable here;
//  - `virtual_domains.owner_id` (already present since 1782760166966, but never
//    FK-constrained) becomes a real FK to `accounts`: the account that creates
//    a domain becomes its owner with full scoped rights on it;
//  - a generic `audit_log` table records every ACL-relevant mutation (who,
//    what, when, before/after).
export class ReworkAclModel1783277858895 implements MigrationInterface {
  name = "ReworkAclModel1783277858895";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`accounts\`
        ADD COLUMN \`group_id\` int NULL AFTER \`is_root\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`accounts\`
        ADD CONSTRAINT \`fk_accounts_group\`
        FOREIGN KEY (\`group_id\`) REFERENCES \`groups\` (\`id\`) ON DELETE SET NULL
    `);

    await queryRunner.query("DROP TABLE `group_members`");

    await queryRunner.query(`
      ALTER TABLE \`groups\`
        ADD COLUMN \`is_default\` tinyint(1) NOT NULL DEFAULT 0 AFTER \`owner_id\`
    `);

    // `owner_id` itself already exists on `virtual_domains` (see
    // 1782760166966-CreateVirtualMail) but was never FK-constrained -- only
    // the constraint is new here, the column is not this migration's to drop.
    await queryRunner.query(`
      ALTER TABLE \`virtual_domains\`
        ADD CONSTRAINT \`fk_virtual_domains_owner\`
        FOREIGN KEY (\`owner_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE \`audit_log\` (
        \`id\`          int         NOT NULL AUTO_INCREMENT,
        \`actor_id\`    int         NULL,
        \`action\`      varchar(64) NOT NULL,
        \`entity_type\` varchar(32) NOT NULL,
        \`entity_id\`   int         NULL,
        \`before_json\` text        NULL,
        \`after_json\`  text        NULL,
        \`created_at\`  datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_audit_log_actor\` (\`actor_id\`),
        KEY \`idx_audit_log_entity\` (\`entity_type\`, \`entity_id\`),
        CONSTRAINT \`fk_audit_log_actor\`
          FOREIGN KEY (\`actor_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `audit_log`");

    await queryRunner.query("ALTER TABLE `virtual_domains` DROP FOREIGN KEY `fk_virtual_domains_owner`");

    await queryRunner.query("ALTER TABLE `groups` DROP COLUMN `is_default`");

    await queryRunner.query("ALTER TABLE `accounts` DROP FOREIGN KEY `fk_accounts_group`");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `group_id`");

    await queryRunner.query(`
      CREATE TABLE \`group_members\` (
        \`id\`         int      NOT NULL AUTO_INCREMENT,
        \`group_id\`   int      NOT NULL,
        \`account_id\` int      NOT NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_group_members_group_account\` (\`group_id\`, \`account_id\`),
        CONSTRAINT \`fk_group_members_group\`
          FOREIGN KEY (\`group_id\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_group_members_account\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}
