import type { MigrationInterface, QueryRunner } from "typeorm";

// An open registration link may carry a short free note (30 chars) so its
// issuer remembers who it is meant for; shown in the pending list instead of
// the generic open-link badge.
export class AddInvitationNote1787643591678 implements MigrationInterface {
  name = "AddInvitationNote1787643591678";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` ADD `note` varchar(30) NULL");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` DROP COLUMN `note`");
  }
}
