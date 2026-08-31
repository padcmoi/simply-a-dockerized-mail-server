import type { MigrationInterface, QueryRunner } from "typeorm";

// The previous `accounts.role` varchar column was a leftover from a planned
// role-based-access scheme that never materialised. Future permissions will
// be enforced through an ACL table keyed on (account_id, resource), so the
// only flag we keep on the row itself is `is_root` -- a boolean separating
// the install-time super-admin (seeded by install.sh with is_root=1) from
// every regular account created afterwards (is_root=0). Migrations
// committed to main are immutable, so this is a forward-only `1782839424338`
// step on top of the original `1782760167170-CreateAccounts` table shape.
export class AccountsRoleToIsRoot1782839424338 implements MigrationInterface {
  name = "AccountsRoleToIsRoot1782839424338";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `role`");
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `is_root` tinyint(1) NOT NULL DEFAULT 0 AFTER `password`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `accounts` DROP COLUMN `is_root`");
    await queryRunner.query("ALTER TABLE `accounts` ADD COLUMN `role` varchar(32) NOT NULL DEFAULT 'admin' AFTER `password`");
  }
}
