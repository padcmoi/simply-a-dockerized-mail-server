import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvisibleToGroups1783857403584 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    // An invisible group is a root-only construct: it is completely hidden from
    // every non-root account -- absent from the list, its detail and all its
    // sub-resources 404 -- regardless of membership, ownership or held
    // permissions. Only root sees it and only root may edit anything on it
    // (permissions included). Enforced app-side in GroupsService (the ACL lib
    // has no say in who may see a group); toggling the flag is root-only, not an
    // ACL. Mirrors is_protected: a plain tinyint flag.
    await queryRunner.query("ALTER TABLE `groups` ADD COLUMN is_invisible TINYINT(1) NOT NULL DEFAULT 0 AFTER is_protected");
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query("ALTER TABLE `groups` DROP COLUMN is_invisible");
  }
}
