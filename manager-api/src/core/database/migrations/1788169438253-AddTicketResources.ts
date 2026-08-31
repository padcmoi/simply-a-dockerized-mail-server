import type { MigrationInterface, QueryRunner } from "typeorm";

// A ticket says which mailboxes and aliases it is about.
//
// The domain alone was too coarse: a domain with fifty mailboxes gave the
// support desk no way to know which one the request concerns.
//
// Two pivot tables with real foreign keys, rather than a list of ids stored in
// a column: an id kept in JSON survives the row it names, so a mailbox deleted
// afterwards would leave the ticket pointing at nothing. Here the link is
// CASCADE on both sides, and the pair is the primary key, so naming the same
// address twice is refused by the schema itself. Two tables and not one: a
// single pivot carrying a "kind" column could not hold a real foreign key to
// two different tables, which is the whole point.
//
// Nothing of Postfix's own tables is touched, only referenced.
//
// `app_settings.type_field` gains `boolean` in the same move: whether naming a
// resource is mandatory is a server-wide switch, and the settings store had no
// type to say true or false with.
export class AddTicketResources1788169438253 implements MigrationInterface {
  name = "AddTicketResources1788169438253";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `support_ticket_recipients` (`ticket_id` int NOT NULL, `recipient_id` int NOT NULL, INDEX `idx_support_ticket_recipients_recipient_id` (`recipient_id`), PRIMARY KEY (`ticket_id`, `recipient_id`)) ENGINE=InnoDB"
    );
    await queryRunner.query(
      "CREATE TABLE `support_ticket_aliases` (`ticket_id` int NOT NULL, `alias_id` int NOT NULL, INDEX `idx_support_ticket_aliases_alias_id` (`alias_id`), PRIMARY KEY (`ticket_id`, `alias_id`)) ENGINE=InnoDB"
    );
    await queryRunner.query(
      "ALTER TABLE `app_settings` CHANGE `type_field` `type_field` enum ('number', 'string', 'boolean') NOT NULL"
    );
    await queryRunner.query(
      "ALTER TABLE `support_ticket_recipients` ADD CONSTRAINT `fk_support_ticket_recipients_ticket_id` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE"
    );
    await queryRunner.query(
      "ALTER TABLE `support_ticket_recipients` ADD CONSTRAINT `fk_support_ticket_recipients_recipient_id` FOREIGN KEY (`recipient_id`) REFERENCES `virtual_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE"
    );
    await queryRunner.query(
      "ALTER TABLE `support_ticket_aliases` ADD CONSTRAINT `fk_support_ticket_aliases_ticket_id` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE"
    );
    await queryRunner.query(
      "ALTER TABLE `support_ticket_aliases` ADD CONSTRAINT `fk_support_ticket_aliases_alias_id` FOREIGN KEY (`alias_id`) REFERENCES `virtual_aliases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE"
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `support_ticket_aliases` DROP FOREIGN KEY `fk_support_ticket_aliases_alias_id`");
    await queryRunner.query("ALTER TABLE `support_ticket_aliases` DROP FOREIGN KEY `fk_support_ticket_aliases_ticket_id`");
    await queryRunner.query(
      "ALTER TABLE `support_ticket_recipients` DROP FOREIGN KEY `fk_support_ticket_recipients_recipient_id`"
    );
    await queryRunner.query("ALTER TABLE `support_ticket_recipients` DROP FOREIGN KEY `fk_support_ticket_recipients_ticket_id`");
    await queryRunner.query("DROP TABLE `support_ticket_aliases`");
    await queryRunner.query("DROP TABLE `support_ticket_recipients`");
    // Narrowing the enum with boolean rows still in place would truncate them
    // to an empty value, so they go first.
    await queryRunner.query("DELETE FROM `app_settings` WHERE `type_field` = 'boolean'");
    await queryRunner.query("ALTER TABLE `app_settings` CHANGE `type_field` `type_field` enum ('number', 'string') NOT NULL");
  }
}
