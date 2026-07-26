import type { MigrationInterface, QueryRunner } from "typeorm";

// Lets the author edit a recent message: updated_at records when it was last
// edited (null while untouched, so the UI can mark "edited"), edit_count how
// many times.
export class AddEditFieldsToTicketMessages1785088568867 implements MigrationInterface {
  name = "AddEditFieldsToTicketMessages1785088568867";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `support_ticket_messages` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL");
    await queryRunner.query(
      "ALTER TABLE `support_ticket_messages` ADD COLUMN IF NOT EXISTS `edit_count` int unsigned NOT NULL DEFAULT 0"
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `support_ticket_messages` DROP COLUMN IF EXISTS `edit_count`");
    await queryRunner.query("ALTER TABLE `support_ticket_messages` DROP COLUMN IF EXISTS `updated_at`");
  }
}
