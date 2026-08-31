import type { MigrationInterface, QueryRunner } from "typeorm";

// An invitation can hand the invitee existing, unassigned recipients and
// aliases on acceptance (JSON arrays of ids, see sendInvitationSchema). The
// entity has carried these two columns since that feature shipped, but no
// migration ever created them: they only existed on databases where they had
// been added by hand, so a fresh install broke on every query touching
// AccountInvitation ("Unknown column 'recipient_ids'"). Additive and nullable,
// mirroring `group_ids` right above them.
export class AddResourceIdsToInvitations1788128924923 implements MigrationInterface {
  name = "AddResourceIdsToInvitations1788128924923";

  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_invitations'"
    );
    const present = new Set((columns as { name: string }[]).map((c) => c.name));

    // Guarded one by one: a database that already carries them (added by hand
    // before this migration existed) must migrate as cleanly as a fresh one.
    if (!present.has("recipient_ids")) {
      await queryRunner.query("ALTER TABLE `account_invitations` ADD COLUMN `recipient_ids` text DEFAULT NULL AFTER `group_ids`");
    }
    if (!present.has("alias_ids")) {
      await queryRunner.query("ALTER TABLE `account_invitations` ADD COLUMN `alias_ids` text DEFAULT NULL AFTER `recipient_ids`");
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` DROP COLUMN `alias_ids`");
    await queryRunner.query("ALTER TABLE `account_invitations` DROP COLUMN `recipient_ids`");
  }
}
