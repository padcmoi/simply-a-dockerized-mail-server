import type { MigrationInterface, QueryRunner } from "typeorm";

// Turns `accounts` into strictly authentication material and makes the email the
// login identity: `email` becomes NOT NULL (already UNIQUE since migration 6),
// and the display fields (`username`, `name`, `avatar_url`) leave the table --
// `name`/`avatar_url` were copied into account_profiles by migration 19, and
// `username` disappears entirely (login is by email now). On a fresh install
// `accounts` is empty when this runs (the root row is seeded by install.sh only
// afterwards), so NOT NULL and the column drops are trivially satisfied.
export class AccountsEmailIdentity1783882664787 implements MigrationInterface {
  name = "AccountsEmailIdentity1783882664787";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `accounts` MODIFY `email` varchar(255) NOT NULL");
    // DROP COLUMN also removes the column's UNIQUE index (uq_accounts_username).
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `username`");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `name`");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `avatar_url`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `accounts` MODIFY `email` varchar(255) DEFAULT NULL");
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `username` varchar(255) NOT NULL AFTER `id`");
    await queryRunner.query("ALTER TABLE `accounts` ADD UNIQUE KEY `uq_accounts_username` (`username`)");
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `name` varchar(255) DEFAULT NULL AFTER `username`");
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `avatar_url` varchar(1024) DEFAULT NULL AFTER `email`");
  }
}
