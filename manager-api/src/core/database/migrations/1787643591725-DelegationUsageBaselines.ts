import type { MigrationInterface, QueryRunner } from "typeorm";

// A delegation must allow N NEW recipients/aliases from the moment it is
// granted: the row snapshots the account's counts at grant time (base_*) and
// only what stands beyond that baseline spends the allowance. Existing rows
// are backfilled with today's counts so nothing already owned is billed.
export class DelegationUsageBaselines1787643591725 implements MigrationInterface {
  name = "DelegationUsageBaselines1787643591725";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `domain_delegations` ADD `base_recipients` int NOT NULL DEFAULT 0");
    await queryRunner.query("ALTER TABLE `domain_delegations` ADD `base_aliases` int NOT NULL DEFAULT 0");
    await queryRunner.query("ALTER TABLE `domain_delegations` ADD `base_bytes` bigint NOT NULL DEFAULT 0");
    await queryRunner.query(
      "UPDATE `domain_delegations` d JOIN `virtual_domains` vd ON vd.`id` = d.`domain_id` SET " +
        "d.`base_recipients` = (SELECT COUNT(*) FROM `virtual_users` u WHERE u.`owner_id` = d.`account_id` AND u.`domain` = vd.`domain`), " +
        "d.`base_aliases` = (SELECT COUNT(*) FROM `virtual_aliases` a WHERE a.`owner_id` = d.`account_id` AND a.`domain` = vd.`domain`), " +
        "d.`base_bytes` = (SELECT COALESCE(SUM(u.`quota`), 0) FROM `virtual_users` u WHERE u.`owner_id` = d.`account_id` AND u.`domain` = vd.`domain`)"
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `domain_delegations` DROP COLUMN `base_recipients`");
    await queryRunner.query("ALTER TABLE `domain_delegations` DROP COLUMN `base_aliases`");
    await queryRunner.query("ALTER TABLE `domain_delegations` DROP COLUMN `base_bytes`");
  }
}
