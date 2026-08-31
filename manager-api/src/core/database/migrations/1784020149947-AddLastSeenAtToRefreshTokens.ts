import type { MigrationInterface, QueryRunner } from "typeorm";

// Records the last time a session was actually used (the auth guard touches it on
// each request, throttled). Powers the "online now" flag: a session seen within
// the last minute is currently in use, as opposed to merely valid. Additive and
// nullable (older sessions simply have no last-seen until their next request).
export class AddLastSeenAtToRefreshTokens1784020149947 implements MigrationInterface {
  name = "AddLastSeenAtToRefreshTokens1784020149947";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `refresh_tokens` ADD COLUMN `last_seen_at` datetime DEFAULT NULL AFTER `revoked_at`");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `refresh_tokens` DROP COLUMN `last_seen_at`");
  }
}
