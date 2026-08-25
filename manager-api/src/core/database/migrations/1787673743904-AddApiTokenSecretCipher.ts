import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddApiTokenSecretCipher1787673743904 implements MigrationInterface {
  name = "AddApiTokenSecretCipher1787673743904";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `api_tokens` ADD COLUMN `secret_cipher` varchar(512) NOT NULL DEFAULT '' AFTER `secret_hash`"
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `api_tokens` DROP COLUMN `secret_cipher`");
  }
}
