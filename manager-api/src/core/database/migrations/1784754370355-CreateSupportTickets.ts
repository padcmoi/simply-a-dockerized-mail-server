import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSupportTickets1784754370355 implements MigrationInterface {
  name = "CreateSupportTickets1784754370355";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`support_tickets\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`domain_id\` int(11) NOT NULL,
        \`created_by\` char(36) DEFAULT NULL,
        \`assigned_to\` char(36) DEFAULT NULL,
        \`subject\` varchar(255) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'open',
        \`visibility\` varchar(10) NOT NULL DEFAULT 'private',
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_support_tickets_domain_id\` (\`domain_id\`),
        KEY \`idx_support_tickets_created_by\` (\`created_by\`),
        KEY \`idx_support_tickets_assigned_to\` (\`assigned_to\`),
        CONSTRAINT \`fk_support_tickets_domain_id\`
          FOREIGN KEY (\`domain_id\`) REFERENCES \`virtual_domains\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_support_tickets_created_by\`
          FOREIGN KEY (\`created_by\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT \`fk_support_tickets_assigned_to\`
          FOREIGN KEY (\`assigned_to\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`support_ticket_messages\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`ticket_id\` int(11) NOT NULL,
        \`author_id\` char(36) DEFAULT NULL,
        \`body\` text NOT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_support_ticket_messages_ticket_id\` (\`ticket_id\`),
        CONSTRAINT \`fk_support_ticket_messages_ticket_id\`
          FOREIGN KEY (\`ticket_id\`) REFERENCES \`support_tickets\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_support_ticket_messages_author_id\`
          FOREIGN KEY (\`author_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `support_ticket_messages`");
    await queryRunner.query("DROP TABLE IF EXISTS `support_tickets`");
  }
}
