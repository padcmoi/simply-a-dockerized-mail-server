import { MigrationInterface, QueryRunner } from "typeorm";

export class ActivityLog1788545581029 implements MigrationInterface {
  name = "ActivityLog1788545581029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`activity_log\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`actor_id\` char(36) NULL,
        \`subject_id\` char(36) NULL,
        \`action\` varchar(64) NOT NULL,
        \`entity_type\` varchar(32) NULL,
        \`entity_id\` varchar(64) NULL,
        \`entity_label\` varchar(255) NULL,
        \`details\` json NULL,
        \`ip\` varchar(45) NULL,
        \`user_agent\` varchar(255) NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_activity_log_actor\` (\`actor_id\`, \`created_at\`),
        KEY \`idx_activity_log_subject\` (\`subject_id\`, \`created_at\`),
        KEY \`idx_activity_log_action\` (\`action\`),
        KEY \`idx_activity_log_created\` (\`created_at\`),
        CONSTRAINT \`fk_activity_log_actor\` FOREIGN KEY (\`actor_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE SET NULL ON UPDATE RESTRICT,
        CONSTRAINT \`fk_activity_log_subject\` FOREIGN KEY (\`subject_id\`) REFERENCES \`accounts\` (\`id\`)
          ON DELETE SET NULL ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`activity_log\``);
  }
}
