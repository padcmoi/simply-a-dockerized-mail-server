import type { MigrationInterface, QueryRunner } from "typeorm";

// When set, accepting the invitation makes the new account the owner of this
// domain (virtual_domains.owner_id). Nullable: most invitations grant no
// ownership.
export class AddOwnerDomainToInvitations1784103476879 implements MigrationInterface {
  name = "AddOwnerDomainToInvitations1784103476879";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` ADD COLUMN `owner_domain_id` int DEFAULT NULL AFTER `group_ids`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` DROP COLUMN `owner_domain_id`");
  }
}
