import type { MigrationInterface, QueryRunner } from "typeorm";

export class ServiceMetricsOnMetricsHistory1788557400000 implements MigrationInterface {
  name = "ServiceMetricsOnMetricsHistory1788557400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`metrics_history\`
        ADD COLUMN \`rspamd_scanned\` double NULL,
        ADD COLUMN \`rspamd_no_action\` double NULL,
        ADD COLUMN \`rspamd_greylist\` double NULL,
        ADD COLUMN \`rspamd_add_header\` double NULL,
        ADD COLUMN \`rspamd_reject\` double NULL,
        ADD COLUMN \`rspamd_learned\` double NULL,
        ADD COLUMN \`postfix_active\` double NULL,
        ADD COLUMN \`postfix_deferred\` double NULL,
        ADD COLUMN \`postfix_hold\` double NULL,
        ADD COLUMN \`postfix_incoming\` double NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`metrics_history\`
        DROP COLUMN \`rspamd_scanned\`,
        DROP COLUMN \`rspamd_no_action\`,
        DROP COLUMN \`rspamd_greylist\`,
        DROP COLUMN \`rspamd_add_header\`,
        DROP COLUMN \`rspamd_reject\`,
        DROP COLUMN \`rspamd_learned\`,
        DROP COLUMN \`postfix_active\`,
        DROP COLUMN \`postfix_deferred\`,
        DROP COLUMN \`postfix_hold\`,
        DROP COLUMN \`postfix_incoming\`
    `);
  }
}
