import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountAddresses1788789665624 implements MigrationInterface {
  name = "AccountAddresses1788789665624";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`account_addresses\` (\`account_id\` char(36) NOT NULL, \`ip\` varchar(45) NOT NULL, \`country_code\` char(2) NULL, \`asn\` int UNSIGNED NULL, \`asn_org\` varchar(128) NULL, \`city\` varchar(64) NULL, \`latitude\` decimal(10,7) NOT NULL, \`longitude\` decimal(10,7) NOT NULL, \`login_count\` int UNSIGNED NOT NULL DEFAULT '1', \`first_seen_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(), \`last_seen_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(), INDEX \`idx_account_addresses_last_seen_at\` (\`last_seen_at\`), PRIMARY KEY (\`account_id\`, \`ip\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(`ALTER TABLE \`account_mfa\` DROP COLUMN \`login_latitude\``);
    await queryRunner.query(`ALTER TABLE \`account_mfa\` DROP COLUMN \`login_longitude\``);
    await queryRunner.query(`ALTER TABLE \`account_mfa\` DROP COLUMN \`login_seen_at\``);
    await queryRunner.query(`ALTER TABLE \`account_mfa\` DROP COLUMN \`login_city\``);
    await queryRunner.query(
      `ALTER TABLE \`account_addresses\` ADD CONSTRAINT \`fk_account_addresses_account_id\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `INSERT INTO \`account_addresses\` (\`account_id\`, \`ip\`, \`country_code\`, \`asn\`, \`asn_org\`, \`city\`, \`latitude\`, \`longitude\`, \`login_count\`, \`first_seen_at\`, \`last_seen_at\`)
       SELECT l.actor_id, g.ip, NULLIF(MAX(g.country_code), ''), MAX(g.asn), MAX(g.asn_org), MAX(g.city), MAX(g.latitude), MAX(g.longitude), COUNT(*), MIN(l.created_at), MAX(l.created_at)
       FROM \`activity_log\` l
       JOIN \`geoip_cache\` g ON g.ip = l.ip AND g.resolved = 1 AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL
       JOIN \`accounts\` a ON a.id = l.actor_id
       WHERE l.action = 'auth.login' AND l.created_at >= NOW() - INTERVAL 30 DAY
       GROUP BY l.actor_id, g.ip`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`account_addresses\` DROP FOREIGN KEY \`fk_account_addresses_account_id\``);
    await queryRunner.query(`ALTER TABLE \`account_mfa\` ADD \`login_city\` varchar(64) NULL`);
    await queryRunner.query(`ALTER TABLE \`account_mfa\` ADD \`login_seen_at\` datetime NULL`);
    await queryRunner.query(`ALTER TABLE \`account_mfa\` ADD \`login_longitude\` decimal(10,7) NULL`);
    await queryRunner.query(`ALTER TABLE \`account_mfa\` ADD \`login_latitude\` decimal(10,7) NULL`);
    await queryRunner.query(`DROP INDEX \`idx_account_addresses_last_seen_at\` ON \`account_addresses\``);
    await queryRunner.query(`DROP TABLE \`account_addresses\``);
  }
}
