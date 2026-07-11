import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddProtectedToGroups1783774620371 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    // A protected group can never be deleted, by anyone (root included). The
    // rule itself lives in @naskot/custom-permission-guard (deleteGroup refuses
    // a protected group) and is honoured on the app's raw-delete path too; this
    // column is only the storage. Toggling it is root-only, enforced in
    // GroupsService, not via an ACL. Mirrors is_default: a plain tinyint flag.
    await queryRunner.query("ALTER TABLE `groups` ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0 AFTER is_default");
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query("ALTER TABLE `groups` DROP COLUMN is_protected");
  }
}
