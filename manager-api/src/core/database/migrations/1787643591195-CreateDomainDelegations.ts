import type { MigrationInterface, QueryRunner } from "typeorm";

// First shape of the table, kept byte-identical to what already ran on live
// databases (the row is recorded in `migrations`): a fresh install replays it,
// an already-migrated database skips it, and 1787643591342 reshapes both to the
// current schema.
export class CreateDomainDelegations1787643591195 implements MigrationInterface {
  name = "CreateDomainDelegations1787643591195";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`domain_delegations\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`account_id\` char(36) NOT NULL,
        \`domain_id\` int(11) NOT NULL,
        \`max_recipients\` int(11) NOT NULL,
        \`max_aliases\` int(11) NOT NULL,
        \`reserved_quota_mb\` int(11) NOT NULL,
        \`created_by\` char(36) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_domain_delegations_account_domain\` (\`account_id\`, \`domain_id\`),
        KEY \`idx_domain_delegations_domain_id\` (\`domain_id\`),
        KEY \`idx_domain_delegations_created_by\` (\`created_by\`),
        CONSTRAINT \`fk_domain_delegations_account_id\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_domain_delegations_domain_id\`
          FOREIGN KEY (\`domain_id\`) REFERENCES \`virtual_domains\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_domain_delegations_created_by\`
          FOREIGN KEY (\`created_by\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `domain_delegations`");
  }
}
