import type { MigrationInterface, QueryRunner } from "typeorm";

// Aligns the table with the final grant model: a NULL max means unlimited
// count, and the disk ceiling is renamed quota_mb (a hard cap, not a
// reservation label). The table carried no rows when this shipped.
export class ReshapeDomainDelegations1787643591342 implements MigrationInterface {
  name = "ReshapeDomainDelegations1787643591342";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `domain_delegations` MODIFY `max_recipients` int(11) DEFAULT NULL");
    await queryRunner.query("ALTER TABLE `domain_delegations` MODIFY `max_aliases` int(11) DEFAULT NULL");
    await queryRunner.query("ALTER TABLE `domain_delegations` CHANGE `reserved_quota_mb` `quota_mb` int(11) NOT NULL");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `domain_delegations` CHANGE `quota_mb` `reserved_quota_mb` int(11) NOT NULL");
    await queryRunner.query("ALTER TABLE `domain_delegations` MODIFY `max_aliases` int(11) NOT NULL");
    await queryRunner.query("ALTER TABLE `domain_delegations` MODIFY `max_recipients` int(11) NOT NULL");
  }
}
