import { MigrationInterface, QueryRunner } from "typeorm";

export class DmarcPerDomainSending1789990446870 implements MigrationInterface {
  name = "DmarcPerDomainSending1789990446870";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`dmarc_evaluations\` ADD \`recipient_domain\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`dmarc_outgoing_reports\` ADD \`reporter_domain\` varchar(255) NOT NULL`);
    await queryRunner.query(`CREATE INDEX \`idx_dmarc_evaluations_job\` ON \`dmarc_evaluations\` (\`job_id\`)`);
    await queryRunner.query(`CREATE INDEX \`idx_dmarc_outgoing_reporter\` ON \`dmarc_outgoing_reports\` (\`reporter_domain\`)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`idx_dmarc_outgoing_reporter\` ON \`dmarc_outgoing_reports\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_evaluations_job\` ON \`dmarc_evaluations\``);
    await queryRunner.query(`ALTER TABLE \`dmarc_outgoing_reports\` DROP COLUMN \`reporter_domain\``);
    await queryRunner.query(`ALTER TABLE \`dmarc_evaluations\` DROP COLUMN \`recipient_domain\``);
  }
}
