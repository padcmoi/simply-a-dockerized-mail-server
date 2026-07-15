import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvitedByFkToInvitations1784103883155 implements MigrationInterface {
  name = "AddInvitedByFkToInvitations1784103883155";

  // `invited_by` records the account that sent the invitation. It is now a real
  // FK to `accounts` with ON DELETE SET NULL, so deleting an inviter keeps their
  // invitations (the pointer is just nulled) instead of leaving a dangling id.
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`account_invitations\`
        ADD CONSTRAINT \`fk_account_invitations_invited_by\`
        FOREIGN KEY (\`invited_by\`) REFERENCES \`accounts\` (\`id\`) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_invitations` DROP FOREIGN KEY `fk_account_invitations_invited_by`");
  }
}
