import { MigrationInterface, QueryRunner } from "typeorm";

export class ClamavAgeOnMetricsHistory1789919263933 implements MigrationInterface {
  name = "ClamavAgeOnMetricsHistory1789919263933";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`metrics_history\` ADD \`clamav_age\` double NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`metrics_history\` DROP COLUMN \`clamav_age\``);
  }
}
