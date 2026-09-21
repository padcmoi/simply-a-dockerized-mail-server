import { MigrationInterface, QueryRunner } from "typeorm";

export class DmarcReports1789981206875 implements MigrationInterface {
  name = "DmarcReports1789981206875";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`dmarc_evaluations\` (\`id\` int NOT NULL AUTO_INCREMENT, \`received_at\` bigint NOT NULL, \`job_id\` varchar(64) NOT NULL, \`reporter\` varchar(255) NOT NULL, \`source_ip\` varchar(45) NOT NULL, \`header_from\` varchar(255) NOT NULL, \`envelope_from\` varchar(255) NULL, \`policy_domain\` varchar(255) NOT NULL, \`spf_result\` varchar(16) NOT NULL, \`dkim\` json NOT NULL, \`dkim_aligned\` varchar(8) NOT NULL, \`spf_aligned\` varchar(8) NOT NULL, \`disposition\` varchar(16) NOT NULL, \`policy\` varchar(16) NULL, \`subdomain_policy\` varchar(16) NULL, \`adkim\` char(1) NOT NULL, \`aspf\` char(1) NOT NULL, \`pct\` smallint NOT NULL, \`rua\` json NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_dmarc_evaluations_received\` (\`received_at\`), INDEX \`idx_dmarc_evaluations_domain_received\` (\`policy_domain\`, \`received_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `CREATE TABLE \`dmarc_outgoing_reports\` (\`id\` int NOT NULL AUTO_INCREMENT, \`report_id\` varchar(255) NOT NULL, \`policy_domain\` varchar(255) NOT NULL, \`recipient\` varchar(320) NOT NULL, \`period_begin\` bigint NOT NULL, \`period_end\` bigint NOT NULL, \`records\` int NOT NULL, \`messages\` int NOT NULL, \`size_bytes\` int NOT NULL, \`status\` varchar(16) NOT NULL, \`reason\` varchar(1024) NULL, \`attempts\` int NOT NULL DEFAULT '0', \`xml\` mediumtext NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`sent_at\` datetime NULL, INDEX \`idx_dmarc_outgoing_domain\` (\`policy_domain\`), INDEX \`idx_dmarc_outgoing_created\` (\`created_at\`), UNIQUE INDEX \`uq_dmarc_outgoing_report_recipient\` (\`report_id\`, \`recipient\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `CREATE TABLE \`dmarc_incoming_records\` (\`id\` int NOT NULL AUTO_INCREMENT, \`report_id\` int NOT NULL, \`source_ip\` varchar(45) NOT NULL, \`count\` int NOT NULL, \`disposition\` varchar(16) NOT NULL, \`dkim\` varchar(8) NOT NULL, \`spf\` varchar(8) NOT NULL, \`header_from\` varchar(255) NOT NULL, \`envelope_from\` varchar(255) NULL, \`envelope_to\` varchar(255) NULL, \`dkim_results\` json NOT NULL, \`spf_results\` json NOT NULL, \`reasons\` json NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `CREATE TABLE \`dmarc_incoming_reports\` (\`id\` int NOT NULL AUTO_INCREMENT, \`org_name\` varchar(255) NOT NULL, \`org_email\` varchar(320) NOT NULL, \`extra_contact\` varchar(512) NULL, \`report_id\` varchar(255) NOT NULL, \`domain\` varchar(255) NOT NULL, \`period_begin\` bigint NOT NULL, \`period_end\` bigint NOT NULL, \`adkim\` char(1) NOT NULL, \`aspf\` char(1) NOT NULL, \`p\` varchar(16) NOT NULL, \`sp\` varchar(16) NOT NULL, \`pct\` smallint NOT NULL, \`records\` int NOT NULL, \`messages\` int NOT NULL, \`dmarc_pass\` int NOT NULL, \`dkim_pass\` int NOT NULL, \`spf_pass\` int NOT NULL, \`mailbox\` varchar(320) NOT NULL, \`xml\` mediumtext NOT NULL, \`received_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_dmarc_incoming_received\` (\`received_at\`), INDEX \`idx_dmarc_incoming_domain_begin\` (\`domain\`, \`period_begin\`), UNIQUE INDEX \`uq_dmarc_incoming_org_report\` (\`org_name\`, \`report_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `CREATE TABLE \`dmarc_inbox_messages\` (\`id\` int NOT NULL AUTO_INCREMENT, \`mailbox\` varchar(320) NOT NULL, \`message_key\` varchar(255) NOT NULL, \`status\` varchar(16) NOT NULL, \`detail\` varchar(1024) NULL, \`message_id\` varchar(512) NULL, \`sender\` varchar(320) NULL, \`subject\` varchar(512) NULL, \`reports\` int NOT NULL DEFAULT '0', \`scanned_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_dmarc_inbox_scanned\` (\`scanned_at\`), UNIQUE INDEX \`uq_dmarc_inbox_mailbox_key\` (\`mailbox\`, \`message_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `ALTER TABLE \`dmarc_incoming_records\` ADD CONSTRAINT \`FK_c602fe7d70c29d01bc8807d7f71\` FOREIGN KEY (\`report_id\`) REFERENCES \`dmarc_incoming_reports\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`dmarc_incoming_records\` DROP FOREIGN KEY \`FK_c602fe7d70c29d01bc8807d7f71\``);
    await queryRunner.query(`DROP INDEX \`uq_dmarc_inbox_mailbox_key\` ON \`dmarc_inbox_messages\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_inbox_scanned\` ON \`dmarc_inbox_messages\``);
    await queryRunner.query(`DROP TABLE \`dmarc_inbox_messages\``);
    await queryRunner.query(`DROP INDEX \`uq_dmarc_incoming_org_report\` ON \`dmarc_incoming_reports\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_incoming_domain_begin\` ON \`dmarc_incoming_reports\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_incoming_received\` ON \`dmarc_incoming_reports\``);
    await queryRunner.query(`DROP TABLE \`dmarc_incoming_reports\``);
    await queryRunner.query(`DROP TABLE \`dmarc_incoming_records\``);
    await queryRunner.query(`DROP INDEX \`uq_dmarc_outgoing_report_recipient\` ON \`dmarc_outgoing_reports\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_outgoing_created\` ON \`dmarc_outgoing_reports\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_outgoing_domain\` ON \`dmarc_outgoing_reports\``);
    await queryRunner.query(`DROP TABLE \`dmarc_outgoing_reports\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_evaluations_domain_received\` ON \`dmarc_evaluations\``);
    await queryRunner.query(`DROP INDEX \`idx_dmarc_evaluations_received\` ON \`dmarc_evaluations\``);
    await queryRunner.query(`DROP TABLE \`dmarc_evaluations\``);
  }
}
