import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRevokedAtToApiTokens1782985738516 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE api_tokens ADD COLUMN revoked_at DATETIME NULL DEFAULT NULL AFTER locked_until`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE api_tokens DROP COLUMN revoked_at`);
  }
}
