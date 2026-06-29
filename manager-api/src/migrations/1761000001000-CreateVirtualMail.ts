import type { MigrationInterface, QueryRunner } from "typeorm";

// Postfix virtual-mailbox schema: the 5 interdependent `virtual_*` tables
// plus the 5 quota-aggregation triggers that keep `virtual_quota_domains` in
// sync with the per-user `virtual_quota_users` rows. The FK chain enforces
// `virtual_users` / `virtual_aliases` / `virtual_quota_*` belong to a domain
// that exists in `virtual_domains` (ON DELETE / UPDATE CASCADE).
export class CreateVirtualMail1782760166966 implements MigrationInterface {
  name = "CreateVirtualMail1782760166966";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`virtual_domains\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`owner_id\` int(11) DEFAULT NULL,
        \`domain\` varchar(255) NOT NULL,
        \`quota\` bigint(20) NOT NULL DEFAULT 0,
        \`active\` tinyint(1) NOT NULL DEFAULT 0,
        \`user_start_date\` date NOT NULL DEFAULT '1970-01-01',
        \`user_end_date\` date DEFAULT NULL,
        \`last_activity\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_virtual_domains_domain\` (\`domain\`),
        KEY \`idx_virtual_domains_owner_id\` (\`owner_id\`),
        KEY \`idx_virtual_domains_domain\` (\`domain\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`virtual_users\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`owner_id\` int(11) DEFAULT NULL,
        \`domain\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(128) NOT NULL,
        \`maildir\` char(50) NOT NULL,
        \`quota\` bigint(20) NOT NULL DEFAULT 0,
        \`active\` tinyint(1) NOT NULL DEFAULT 0,
        \`uid\` char(15) NOT NULL DEFAULT 'vmail',
        \`gid\` char(15) NOT NULL DEFAULT 'vmail',
        \`user_start_date\` date NOT NULL DEFAULT '1970-01-01',
        \`user_end_date\` date DEFAULT NULL,
        \`last_activity\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_virtual_users_email\` (\`email\`),
        KEY \`idx_virtual_users_owner_id\` (\`owner_id\`),
        KEY \`idx_virtual_users_domain\` (\`domain\`),
        CONSTRAINT \`fk_virtual_users_domain\`
          FOREIGN KEY (\`domain\`) REFERENCES \`virtual_domains\` (\`domain\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`virtual_aliases\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`owner_id\` int(11) DEFAULT NULL,
        \`domain\` varchar(255) NOT NULL,
        \`source\` varchar(255) NOT NULL,
        \`destination\` varchar(255) NOT NULL,
        \`user_start_date\` date NOT NULL DEFAULT '1970-01-01',
        \`user_end_date\` date DEFAULT NULL,
        \`last_activity\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_virtual_aliases_source\` (\`source\`),
        KEY \`idx_virtual_aliases_owner_id\` (\`owner_id\`),
        KEY \`idx_virtual_aliases_domain\` (\`domain\`),
        CONSTRAINT \`fk_virtual_aliases_domain\`
          FOREIGN KEY (\`domain\`) REFERENCES \`virtual_domains\` (\`domain\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`virtual_quota_domains\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`domain\` varchar(255) NOT NULL,
        \`bytes\` bigint(20) NOT NULL DEFAULT 0,
        \`messages\` bigint(20) NOT NULL DEFAULT 0,
        \`last_activity\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_virtual_quota_domains_domain\` (\`domain\`),
        CONSTRAINT \`fk_virtual_quota_domains_domain\`
          FOREIGN KEY (\`domain\`) REFERENCES \`virtual_domains\` (\`domain\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`virtual_quota_users\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`domain\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`bytes\` bigint(20) NOT NULL DEFAULT 0,
        \`messages\` bigint(20) NOT NULL DEFAULT 0,
        \`last_activity\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_virtual_quota_users_domain\` (\`domain\`),
        KEY \`idx_virtual_quota_users_email\` (\`email\`),
        CONSTRAINT \`fk_virtual_quota_users_domain\`
          FOREIGN KEY (\`domain\`) REFERENCES \`virtual_domains\` (\`domain\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_virtual_quota_users_email\`
          FOREIGN KEY (\`email\`) REFERENCES \`virtual_users\` (\`email\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Quota triggers. The two AFTER INSERT helpers auto-create the matching
    // `virtual_quota_*` row whenever a domain / user lands. Guarded with NOT
    // EXISTS so an `INSERT ... ON DUPLICATE KEY UPDATE` path (MariaDB fires
    // AFTER INSERT on both insert and update branches) does not stack a
    // duplicate quota row. The other three keep `virtual_quota_domains`
    // aggregates in sync with the per-user rows on every write.
    await queryRunner.query(`
      CREATE TRIGGER \`virtual_users_after_insert_quota\`
      AFTER INSERT ON \`virtual_users\`
      FOR EACH ROW
      BEGIN
        INSERT INTO \`virtual_quota_users\` (\`domain\`, \`email\`, \`bytes\`, \`messages\`)
        SELECT NEW.\`domain\`, NEW.\`email\`, 0, 0
        WHERE NOT EXISTS (SELECT 1 FROM \`virtual_quota_users\` WHERE \`email\` = NEW.\`email\`);
      END
    `);
    await queryRunner.query(`
      CREATE TRIGGER \`virtual_domains_after_insert_quota\`
      AFTER INSERT ON \`virtual_domains\`
      FOR EACH ROW
      BEGIN
        INSERT INTO \`virtual_quota_domains\` (\`domain\`, \`bytes\`, \`messages\`)
        SELECT NEW.\`domain\`, 0, 0
        WHERE NOT EXISTS (SELECT 1 FROM \`virtual_quota_domains\` WHERE \`domain\` = NEW.\`domain\`);
      END
    `);
    await queryRunner.query(`
      CREATE TRIGGER \`virtual_quota_users_after_update_agg\`
      AFTER UPDATE ON \`virtual_quota_users\`
      FOR EACH ROW
      BEGIN
        UPDATE \`virtual_quota_domains\`
        SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0),
            \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0)
        WHERE \`domain\` = NEW.\`domain\`;
      END
    `);
    await queryRunner.query(`
      CREATE TRIGGER \`virtual_quota_users_after_insert_agg\`
      AFTER INSERT ON \`virtual_quota_users\`
      FOR EACH ROW
      BEGIN
        UPDATE \`virtual_quota_domains\`
        SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0),
            \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0)
        WHERE \`domain\` = NEW.\`domain\`;
      END
    `);
    await queryRunner.query(`
      CREATE TRIGGER \`virtual_quota_users_after_delete_agg\`
      AFTER DELETE ON \`virtual_quota_users\`
      FOR EACH ROW
      BEGIN
        UPDATE \`virtual_quota_domains\`
        SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`virtual_quota_users\` WHERE \`domain\` = OLD.\`domain\`), 0),
            \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`virtual_quota_users\` WHERE \`domain\` = OLD.\`domain\`), 0)
        WHERE \`domain\` = OLD.\`domain\`;
      END
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TRIGGER IF EXISTS `virtual_quota_users_after_delete_agg`");
    await queryRunner.query("DROP TRIGGER IF EXISTS `virtual_quota_users_after_insert_agg`");
    await queryRunner.query("DROP TRIGGER IF EXISTS `virtual_quota_users_after_update_agg`");
    await queryRunner.query("DROP TRIGGER IF EXISTS `virtual_domains_after_insert_quota`");
    await queryRunner.query("DROP TRIGGER IF EXISTS `virtual_users_after_insert_quota`");
    await queryRunner.query("DROP TABLE IF EXISTS `virtual_quota_users`");
    await queryRunner.query("DROP TABLE IF EXISTS `virtual_quota_domains`");
    await queryRunner.query("DROP TABLE IF EXISTS `virtual_aliases`");
    await queryRunner.query("DROP TABLE IF EXISTS `virtual_users`");
    await queryRunner.query("DROP TABLE IF EXISTS `virtual_domains`");
  }
}
