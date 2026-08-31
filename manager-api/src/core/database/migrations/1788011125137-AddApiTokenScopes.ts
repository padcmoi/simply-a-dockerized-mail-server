import type { MigrationInterface, QueryRunner } from "typeorm";

// A key may now be narrower than the account that owns it.
//
// Until here a key carried every right its account held, with no way to say
// less: a key minted for a backup script could do anything its owner could, and
// a root account's key was root. The account stays the ceiling, and this column
// is the floor.
//
// NULL is what every existing key gets and keeps meaning "everything the account
// may do", so nothing that works today stops working. A key is only narrowed by
// someone deliberately narrowing it.
export class AddApiTokenScopes1788011125137 implements MigrationInterface {
  name = "AddApiTokenScopes1788011125137";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `api_tokens` ADD `scopes` text NULL AFTER `allowed_ips`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `api_tokens` DROP COLUMN `scopes`");
  }
}
