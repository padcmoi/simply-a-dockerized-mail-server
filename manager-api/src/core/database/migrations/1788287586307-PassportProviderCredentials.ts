import { MigrationInterface, QueryRunner } from "typeorm";
import { encryptSecret } from "../../auth/api-token/api-token.cipher";

export class PassportProviderCredentials1788287586307 implements MigrationInterface {
  name = "PassportProviderCredentials1788287586307";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`passport_provider_credentials\` (
        \`provider\` varchar(32) NOT NULL,
        \`client_id\` varchar(255) NOT NULL,
        \`client_secret_cipher\` varchar(512) NOT NULL,
        \`enabled\` tinyint(1) NOT NULL DEFAULT 0,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`provider\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // One-shot carry-over of a deployment configured before this table existed:
    // the pair is read from the environment as it stands while this runs, sealed
    // and written here. Those two variables can then be deleted from .env for
    // good, which is the whole point of the table.
    const pepper = process.env.MANAGER_API_TOKEN_PEPPER;
    const clientId = (process.env.MANAGER_OAUTH_GOOGLE_CLIENT_ID || process.env.MANAGER_GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = (
      process.env.MANAGER_OAUTH_GOOGLE_CLIENT_SECRET ||
      process.env.MANAGER_GOOGLE_CLIENT_SECRET ||
      ""
    ).trim();
    if (pepper && clientId && clientSecret) {
      await queryRunner.query(
        `INSERT INTO \`passport_provider_credentials\` (\`provider\`, \`client_id\`, \`client_secret_cipher\`, \`enabled\`)
         VALUES (?, ?, ?, 1)`,
        ["google", clientId, encryptSecret(clientSecret, pepper)]
      );
    }

    // The per-provider on/off flag now lives on the row above, so its old
    // settings key would be read by nothing and drift from what is shown.
    await queryRunner.query(`DELETE FROM \`app_settings\` WHERE \`key\` = 'passport_providers'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`passport_provider_credentials\``);
  }
}
