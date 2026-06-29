import type { MigrationInterface, QueryRunner } from "typeorm";

// Postfix SMTP-time blacklist consumed by `smtpd_sender_restrictions` through
// the two `mysql-sender-blacklist*.cf` lookup files. Rows match on the full
// email address (`sender = 'user@example.com'`) or on the bare domain
// (`sender = '@example.com'`). Stand-alone table, no FK.
export class CreateSieveRejectSenders1782760167052 implements MigrationInterface {
  name = "CreateSieveRejectSenders1782760167052";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`sieve_reject_senders\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`sender\` varchar(255) NOT NULL,
        \`enabled\` int(11) NOT NULL DEFAULT 1,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_sieve_reject_senders_sender\` (\`sender\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `sieve_reject_senders`");
  }
}
