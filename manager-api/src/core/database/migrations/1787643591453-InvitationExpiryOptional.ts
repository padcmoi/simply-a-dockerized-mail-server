import type { MigrationInterface, QueryRunner } from "typeorm";

// A delegation invitation or open link may be granted without an expiry:
// NULL means it stands until revoked. Plain account invitations keep setting
// a date.
export class InvitationExpiryOptional1787643591453 implements MigrationInterface {
  name = "InvitationExpiryOptional1787643591453";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` MODIFY `expires_at` datetime DEFAULT NULL");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE `account_invitations` SET `expires_at` = NOW() WHERE `expires_at` IS NULL");
    await queryRunner.query("ALTER TABLE `account_invitations` MODIFY `expires_at` datetime NOT NULL");
  }
}
