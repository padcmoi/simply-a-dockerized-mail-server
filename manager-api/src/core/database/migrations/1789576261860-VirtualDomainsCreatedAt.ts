import { MigrationInterface, QueryRunner } from "typeorm";

export class VirtualDomainsCreatedAt1789576261860 implements MigrationInterface {
  name = "VirtualDomainsCreatedAt1789576261860";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_domains\` ADD \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_domains\` DROP COLUMN \`created_at\``);
  }
}
