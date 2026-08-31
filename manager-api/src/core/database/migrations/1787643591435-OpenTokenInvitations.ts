import type { MigrationInterface, QueryRunner } from "typeorm";

// An open registration token is an invitation with no pinned email: the visitor
// chooses their own identity at acceptance. NULL marks that mode.
export class OpenTokenInvitations1787643591435 implements MigrationInterface {
  name = "OpenTokenInvitations1787643591435";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` MODIFY `email` varchar(255) DEFAULT NULL");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM `account_invitations` WHERE `email` IS NULL");
    await queryRunner.query("ALTER TABLE `account_invitations` MODIFY `email` varchar(255) NOT NULL");
  }
}
