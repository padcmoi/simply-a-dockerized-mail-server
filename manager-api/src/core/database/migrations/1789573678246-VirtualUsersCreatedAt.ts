import { MigrationInterface, QueryRunner } from "typeorm";

export class VirtualUsersCreatedAt1789573678246 implements MigrationInterface {
  name = "VirtualUsersCreatedAt1789573678246";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_users\` ADD \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`virtual_users\` DROP COLUMN \`created_at\``);
  }
}
