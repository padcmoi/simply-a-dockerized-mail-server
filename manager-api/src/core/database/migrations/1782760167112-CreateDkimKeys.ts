import type { MigrationInterface, QueryRunner } from "typeorm";

// Persisted DKIM material per (domain, selector). manager-api owns this table:
// install.sh and the manager-api/dkim endpoints both go through the opendkim
// sidecar to generate keys, then upsert the public/TXT material here so the
// admin UI can display the DNS record without re-asking the sidecar. FK to
// `virtual_domains.domain` so deleting a domain cleans up its DKIM rows.
export class CreateDkimKeys1782760167112 implements MigrationInterface {
  name = "CreateDkimKeys1782760167112";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`dkim_keys\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`domain\` varchar(255) NOT NULL,
        \`selector\` varchar(255) NOT NULL,
        \`dns_name\` varchar(512) NOT NULL,
        \`public_key\` text NOT NULL,
        \`txt_record\` text NOT NULL,
        \`private_key_path\` varchar(512) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_dkim_keys_domain_selector\` (\`domain\`, \`selector\`),
        KEY \`idx_dkim_keys_domain\` (\`domain\`),
        CONSTRAINT \`fk_dkim_keys_domain\`
          FOREIGN KEY (\`domain\`) REFERENCES \`virtual_domains\` (\`domain\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `dkim_keys`");
  }
}
