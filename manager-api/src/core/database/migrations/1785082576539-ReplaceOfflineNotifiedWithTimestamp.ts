import type { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceOfflineNotifiedWithTimestamp1785082576539 implements MigrationInterface {
  name = "ReplaceOfflineNotifiedWithTimestamp1785082576539";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `account_profiles` ADD COLUMN IF NOT EXISTS `offline_notified_at` datetime DEFAULT NULL AFTER `presence_at`"
    );
    await queryRunner.query("ALTER TABLE `account_profiles` DROP COLUMN IF EXISTS `offline_notified`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `account_profiles` ADD COLUMN IF NOT EXISTS `offline_notified` tinyint(1) NOT NULL DEFAULT 0 AFTER `presence_at`"
    );
    await queryRunner.query("ALTER TABLE `account_profiles` DROP COLUMN IF EXISTS `offline_notified_at`");
  }
}
