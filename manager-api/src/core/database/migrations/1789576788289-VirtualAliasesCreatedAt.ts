import { MigrationInterface, QueryRunner } from "typeorm";

export class VirtualAliasesCreatedAt1789576788289 implements MigrationInterface {
  name = "VirtualAliasesCreatedAt1789576788289";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_aliases\` ADD \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_aliases\` DROP COLUMN \`created_at\``);
  }
}
