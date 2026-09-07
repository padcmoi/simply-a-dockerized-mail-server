import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountMfaLoginCity1788787160772 implements MigrationInterface {
  name = "AccountMfaLoginCity1788787160772";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`account_mfa\` ADD \`login_city\` varchar(64) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`account_mfa\` DROP COLUMN \`login_city\``);
  }
}
