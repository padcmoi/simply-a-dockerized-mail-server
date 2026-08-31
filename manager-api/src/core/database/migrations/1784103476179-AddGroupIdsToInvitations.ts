import type { MigrationInterface, QueryRunner } from "typeorm";

// Invitations can now target several groups at once (JSON array of group ids),
// replacing the single group_id. Additive and nullable; the old group_id stays
// for existing rows.
export class AddGroupIdsToInvitations1784103476179 implements MigrationInterface {
  name = "AddGroupIdsToInvitations1784103476179";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` ADD COLUMN `group_ids` text DEFAULT NULL AFTER `group_id`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` DROP COLUMN `group_ids`");
  }
}
