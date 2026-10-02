import type { MigrationInterface, QueryRunner } from "typeorm";

export class Backups1790932698796 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(
      "CREATE TABLE `backup_runs` (" +
        "id INT NOT NULL AUTO_INCREMENT, " +
        "started_at DATETIME NOT NULL, " +
        "finished_at DATETIME NOT NULL, " +
        "result VARCHAR(16) NOT NULL, " +
        "step VARCHAR(16) NOT NULL, " +
        "error VARCHAR(500) NOT NULL DEFAULT '', " +
        "duration_seconds INT NOT NULL DEFAULT 0, " +
        "outage_seconds INT NOT NULL DEFAULT 0, " +
        "archive VARCHAR(64) NOT NULL DEFAULT '', " +
        "archive_bytes BIGINT NOT NULL DEFAULT 0, " +
        "stored_in VARCHAR(255) NOT NULL DEFAULT '', " +
        "offsite_target VARCHAR(255) NOT NULL DEFAULT '', " +
        "offsite_sent TINYINT(1) NOT NULL DEFAULT 0, " +
        "log MEDIUMTEXT NOT NULL, " +
        "PRIMARY KEY (id), " +
        "UNIQUE KEY uq_backup_runs_started_at (started_at)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    await queryRunner.query(
      "CREATE TABLE `backup_files` (" +
        "name VARCHAR(64) NOT NULL, " +
        "bytes BIGINT NOT NULL DEFAULT 0, " +
        "created_at DATETIME NOT NULL, " +
        "local_present TINYINT(1) NOT NULL DEFAULT 0, " +
        "local_dir VARCHAR(255) NOT NULL DEFAULT '', " +
        "local_project_dir VARCHAR(255) NULL, " +
        "local_deleted_at DATETIME NULL, " +
        "offsite_target VARCHAR(255) NOT NULL DEFAULT '', " +
        "offsite_sent_at DATETIME NULL, " +
        "offsite_deleted_at DATETIME NULL, " +
        "PRIMARY KEY (name)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query("DROP TABLE `backup_files`");
    await queryRunner.query("DROP TABLE `backup_runs`");
  }
}
