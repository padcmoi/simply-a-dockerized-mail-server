import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMailSettings1785082504560 implements MigrationInterface {
  name = "CreateMailSettings1785082504560";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mail_settings\` (
        \`provider\` varchar(20) NOT NULL,
        \`host\` varchar(255) DEFAULT NULL,
        \`port\` int(11) DEFAULT NULL,
        \`secure\` tinyint(1) NOT NULL DEFAULT 0,
        \`username\` varchar(255) DEFAULT NULL,
        \`password\` varchar(255) DEFAULT NULL,
        \`from_address\` varchar(255) DEFAULT NULL,
        \`selected\` tinyint(1) DEFAULT NULL,
        \`validated\` tinyint(1) NOT NULL DEFAULT 0,
        \`otp\` char(6) DEFAULT NULL,
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`provider\`),
        UNIQUE KEY \`uq_mail_settings_selected\` (\`selected\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`mail_settings\``);
  }
}
