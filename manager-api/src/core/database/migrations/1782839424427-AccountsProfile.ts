import type { MigrationInterface, QueryRunner } from "typeorm";

// Adds a profile surface on top of the bootstrap-only `accounts` row so the
// manager-ui can display + edit a friendlier identity in the sidebar avatar
// (and so future ACLs can address an operator by email rather than the raw
// installer username). `email` is nullable + UNIQUE: nothing in the mail
// stack uses it for delivery -- it only labels the manager account. Forward-
// only migration; previous 1782839424338-AccountsRoleToIsRoot stays untouched
// per the immutable-migrations rule.
export class AccountsProfile1782839424427 implements MigrationInterface {
  name = "AccountsProfile1782839424427";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `name` varchar(255) DEFAULT NULL AFTER `username`");
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `email` varchar(255) DEFAULT NULL AFTER `name`");
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `avatar_url` varchar(1024) DEFAULT NULL AFTER `email`");
    await queryRunner.query("ALTER TABLE `accounts` ADD UNIQUE KEY `uq_accounts_email` (`email`)");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `accounts` DROP INDEX `uq_accounts_email`");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `avatar_url`");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `email`");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `name`");
  }
}
