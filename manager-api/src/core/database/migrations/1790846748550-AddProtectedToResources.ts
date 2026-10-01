import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddProtectedToResources1790846748550 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0");
    await queryRunner.query("ALTER TABLE `virtual_domains` ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0");
    await queryRunner.query("ALTER TABLE `virtual_users` ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0");
    await queryRunner.query("ALTER TABLE `virtual_aliases` ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0");
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query("ALTER TABLE `virtual_aliases` DROP COLUMN is_protected");
    await queryRunner.query("ALTER TABLE `virtual_users` DROP COLUMN is_protected");
    await queryRunner.query("ALTER TABLE `virtual_domains` DROP COLUMN is_protected");
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN is_protected");
  }
}
