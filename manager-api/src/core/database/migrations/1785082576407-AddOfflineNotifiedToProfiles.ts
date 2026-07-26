import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddOfflineNotifiedToProfiles1785082576407 implements MigrationInterface {
  name = "AddOfflineNotifiedToProfiles1785082576407";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `account_profiles` ADD COLUMN IF NOT EXISTS `offline_notified` tinyint(1) NOT NULL DEFAULT 0 AFTER `presence_at`"
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_profiles` DROP COLUMN `offline_notified`");
  }
}
