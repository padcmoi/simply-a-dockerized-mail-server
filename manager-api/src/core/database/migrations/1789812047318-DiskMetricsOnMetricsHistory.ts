import type { MigrationInterface, QueryRunner } from "typeorm";

export class DiskMetricsOnMetricsHistory1789812047318 implements MigrationInterface {
  name = "DiskMetricsOnMetricsHistory1789812047318";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`metrics_history\`
        ADD COLUMN \`disk_used\` double NULL,
        ADD COLUMN \`disk_total\` double NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`metrics_history\`
        DROP COLUMN \`disk_used\`,
        DROP COLUMN \`disk_total\`
    `);
  }
}
