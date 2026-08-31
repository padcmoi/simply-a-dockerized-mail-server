import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMetricsHistory1785867508568 implements MigrationInterface {
  name = "CreateMetricsHistory1785867508568";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`metrics_history\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`at\` bigint NOT NULL,
        \`cpu\` double NULL,
        \`load_1\` double NOT NULL,
        \`load_5\` double NOT NULL,
        \`load_15\` double NOT NULL,
        \`memory_used\` double NOT NULL,
        \`memory_total\` double NOT NULL,
        \`net_in\` double NULL,
        \`net_out\` double NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_metrics_history_at\` (\`at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `metrics_history`");
  }
}
