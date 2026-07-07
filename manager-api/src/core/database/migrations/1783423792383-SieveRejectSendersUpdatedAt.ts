import type { MigrationInterface, QueryRunner } from "typeorm";

export class SieveRejectSendersUpdatedAt1783423792383 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(
      `ALTER TABLE sieve_reject_senders MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE sieve_reject_senders ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`
    );
    // ADD COLUMN backfills existing rows with NOW(), which would wrongly read
    // as "every row was just modified" -- nothing has touched these rows
    // since creation, so their last-known-update is their creation time.
    await queryRunner.query(`UPDATE sieve_reject_senders SET updated_at = created_at`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE sieve_reject_senders DROP COLUMN updated_at`);
    await queryRunner.query(
      `ALTER TABLE sieve_reject_senders MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    );
  }
}
