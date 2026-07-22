import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSupportTicketReads1784761438849 implements MigrationInterface {
  name = "CreateSupportTicketReads1784761438849";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`support_ticket_reads\` (
        \`ticket_id\` int(11) NOT NULL,
        \`account_id\` char(36) NOT NULL,
        \`last_read_message_id\` int(11) NOT NULL DEFAULT 0,
        \`read_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`ticket_id\`, \`account_id\`),
        KEY \`idx_support_ticket_reads_account_id\` (\`account_id\`),
        CONSTRAINT \`fk_support_ticket_reads_ticket_id\`
          FOREIGN KEY (\`ticket_id\`) REFERENCES \`support_tickets\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_support_ticket_reads_account_id\`
          FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`support_ticket_reads\``);
  }
}
