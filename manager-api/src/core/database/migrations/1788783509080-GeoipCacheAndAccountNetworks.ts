import { MigrationInterface, QueryRunner } from "typeorm";

export class GeoipCacheAndAccountNetworks1788783509080 implements MigrationInterface {
  name = "GeoipCacheAndAccountNetworks1788783509080";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`geoip_cache\` (\`ip\` varchar(45) NOT NULL, \`resolved\` tinyint(1) NOT NULL DEFAULT '0', \`country_code\` char(2) NULL, \`country\` varchar(64) NULL, \`region\` varchar(64) NULL, \`city\` varchar(64) NULL, \`latitude\` decimal(10,7) NULL, \`longitude\` decimal(10,7) NULL, \`asn\` int UNSIGNED NULL, \`asn_org\` varchar(128) NULL, \`provider\` varchar(32) NULL, \`fetched_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(), \`expires_at\` datetime NOT NULL, \`last_read_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(), INDEX \`idx_geoip_cache_expires_at\` (\`expires_at\`), PRIMARY KEY (\`ip\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `CREATE TABLE \`account_networks\` (\`account_id\` char(36) NOT NULL, \`country_code\` char(2) NOT NULL, \`asn\` int UNSIGNED NOT NULL, \`asn_org\` varchar(128) NULL, \`last_city\` varchar(64) NULL, \`last_ip\` varchar(45) NULL, \`login_count\` int UNSIGNED NOT NULL DEFAULT '1', \`first_seen_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(), \`last_seen_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(), PRIMARY KEY (\`account_id\`, \`country_code\`, \`asn\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `ALTER TABLE \`account_networks\` ADD CONSTRAINT \`fk_account_networks_account_id\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`account_networks\` DROP FOREIGN KEY \`fk_account_networks_account_id\``);
    await queryRunner.query(`DROP TABLE \`account_networks\``);
    await queryRunner.query(`DROP INDEX \`idx_geoip_cache_expires_at\` ON \`geoip_cache\``);
    await queryRunner.query(`DROP TABLE \`geoip_cache\``);
  }
}
