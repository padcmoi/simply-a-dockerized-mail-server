import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountMfa1788705881275 implements MigrationInterface {
  name = "AccountMfa1788705881275";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`account_mfa\` (\`account_id\` char(36) NOT NULL, \`login_latitude\` decimal(10,7) NULL, \`login_longitude\` decimal(10,7) NULL, \`login_seen_at\` datetime NULL, \`question\` varchar(255) NULL, \`answer_hash\` varchar(255) NULL, \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(), \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (\`account_id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `ALTER TABLE \`account_mfa\` ADD CONSTRAINT \`fk_account_mfa_account_id\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`account_mfa\` DROP FOREIGN KEY \`fk_account_mfa_account_id\``);
    await queryRunner.query(`DROP TABLE \`account_mfa\``);
  }
}
