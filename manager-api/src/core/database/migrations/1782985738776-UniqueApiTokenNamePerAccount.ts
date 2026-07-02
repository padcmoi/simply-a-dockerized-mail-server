import type { MigrationInterface, QueryRunner } from "typeorm";

export class UniqueApiTokenNamePerAccount1782985738776 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE api_tokens ADD UNIQUE KEY uq_api_token_account_name (account_id, name)`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE api_tokens DROP INDEX uq_api_token_account_name`);
  }
}
