import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateApiTokenAccess1787673743307 implements MigrationInterface {
  name = "CreateApiTokenAccess1787673743307";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`api_token_access\` (
        \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
        \`token_id\` int(11) NOT NULL,
        \`method\` varchar(10) NOT NULL,
        \`route\` varchar(512) NOT NULL,
        \`status_code\` smallint(6) NOT NULL,
        \`client_ip\` varchar(45) NOT NULL DEFAULT '',
        \`user_agent\` varchar(512) NOT NULL DEFAULT '',
        \`origin\` varchar(255) NOT NULL DEFAULT '',
        \`referer\` varchar(512) NOT NULL DEFAULT '',
        \`duration_ms\` int(11) NOT NULL DEFAULT 0,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_api_token_access_token_created\` (\`token_id\`, \`created_at\`),
        KEY \`idx_api_token_access_created\` (\`created_at\`),
        CONSTRAINT \`fk_api_token_access_token_id\`
          FOREIGN KEY (\`token_id\`) REFERENCES \`api_tokens\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `api_token_access`");
  }
}
