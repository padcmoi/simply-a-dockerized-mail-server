import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGroupsAndPermissions1783277858579 implements MigrationInterface {
  name = "CreateGroupsAndPermissions1783277858579";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`groups\` (
        \`id\`          char(36)     NOT NULL,
        \`name\`        varchar(255) NOT NULL,
        \`description\` varchar(1024) NULL,
        \`owner_id\`    char(36)     NULL,
        \`created_at\`  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_groups_name\` (\`name\`),
        CONSTRAINT \`fk_groups_owner\`
          FOREIGN KEY (\`owner_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

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
      CREATE TABLE \`group_global_permissions\` (
        \`id\`       int         NOT NULL AUTO_INCREMENT,
        \`group_id\` char(36)    NOT NULL,
        \`resource\` varchar(64) NOT NULL,
        \`action\`   varchar(64) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_group_global_permissions\` (\`group_id\`, \`resource\`, \`action\`),
        CONSTRAINT \`fk_group_global_permissions_group\`
          FOREIGN KEY (\`group_id\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`group_domain_permissions\` (
        \`id\`        int         NOT NULL AUTO_INCREMENT,
        \`group_id\`  char(36)    NOT NULL,
        \`domain_id\` int         NOT NULL,
        \`resource\`  varchar(64) NOT NULL,
        \`action\`    varchar(64) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_group_domain_permissions\` (\`group_id\`, \`domain_id\`, \`resource\`, \`action\`),
        CONSTRAINT \`fk_group_domain_permissions_group\`
          FOREIGN KEY (\`group_id\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_group_domain_permissions_domain\`
          FOREIGN KEY (\`domain_id\`) REFERENCES \`virtual_domains\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `group_domain_permissions`");
    await queryRunner.query("DROP TABLE `group_global_permissions`");
    await queryRunner.query("DROP TABLE `group_members`");
    await queryRunner.query("DROP TABLE `groups`");
  }
}
