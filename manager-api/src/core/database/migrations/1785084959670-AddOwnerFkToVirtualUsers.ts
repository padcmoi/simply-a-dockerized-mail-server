import type { MigrationInterface, QueryRunner } from "typeorm";

// virtual_users.owner_id was a plain nullable column with no foreign key, unlike
// virtual_domains.owner_id. Deleting the owning account left a dangling id rather
// than nulling it. This adds the missing FK with ON DELETE SET NULL so a deleted
// account releases its recipients instead of orphaning them.
export class AddOwnerFkToVirtualUsers1785084959670 implements MigrationInterface {
  name = "AddOwnerFkToVirtualUsers1785084959670";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `virtual_users` SET `owner_id` = NULL WHERE `owner_id` IS NOT NULL AND `owner_id` NOT IN (SELECT `id` FROM `accounts`)"
    );
    const rows: { c: number }[] = await queryRunner.query(
      "SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'virtual_users' AND CONSTRAINT_NAME = 'fk_virtual_users_owner'"
    );
    if (Number(rows[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        "ALTER TABLE `virtual_users` ADD CONSTRAINT `fk_virtual_users_owner` FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE"
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `virtual_users` DROP FOREIGN KEY IF EXISTS `fk_virtual_users_owner`");
  }
}
