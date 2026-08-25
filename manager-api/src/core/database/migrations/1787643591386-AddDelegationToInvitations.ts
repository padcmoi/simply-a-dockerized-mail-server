import type { MigrationInterface, QueryRunner } from "typeorm";

// An invitation can stage a delegation: on acceptance the new account receives
// a domain_delegations row on delegation_domain_id with these caps. NULL max =
// unlimited count; the quota is clamped at acceptance to what the domain can
// still commit.
export class AddDelegationToInvitations1787643591386 implements MigrationInterface {
  name = "AddDelegationToInvitations1787643591386";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`account_invitations\`
        ADD COLUMN \`delegation_domain_id\` int(11) DEFAULT NULL,
        ADD COLUMN \`delegation_max_recipients\` int(11) DEFAULT NULL,
        ADD COLUMN \`delegation_max_aliases\` int(11) DEFAULT NULL,
        ADD COLUMN \`delegation_quota_mb\` int(11) DEFAULT NULL,
        ADD CONSTRAINT \`fk_account_invitations_delegation_domain\`
          FOREIGN KEY (\`delegation_domain_id\`) REFERENCES \`virtual_domains\` (\`id\`)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` DROP FOREIGN KEY `fk_account_invitations_delegation_domain`");
    await queryRunner.query(
      "ALTER TABLE `account_invitations` DROP COLUMN `delegation_quota_mb`, DROP COLUMN `delegation_max_aliases`, DROP COLUMN `delegation_max_recipients`, DROP COLUMN `delegation_domain_id`"
    );
  }
}
