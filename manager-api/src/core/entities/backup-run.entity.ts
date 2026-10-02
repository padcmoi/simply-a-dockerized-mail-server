import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "backup_runs" })
export class BackupRun {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Index("uq_backup_runs_started_at", { unique: true })
  @Column({ name: "started_at", type: "datetime" })
  startedAt!: Date;

  @Column({ name: "finished_at", type: "datetime" })
  finishedAt!: Date;

  @Column({ type: "varchar", length: 16 })
  result!: string;

  @Column({ type: "varchar", length: 16 })
  step!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  error!: string;

  @Column({ name: "duration_seconds", type: "int", default: 0 })
  durationSeconds!: number;

  @Column({ name: "outage_seconds", type: "int", default: 0 })
  outageSeconds!: number;

  @Column({ type: "varchar", length: 64, default: "" })
  archive!: string;

  @Column({
    name: "archive_bytes",
    type: "bigint",
    default: 0,
    transformer: { from: (v: string | number) => Number(v), to: (v: number) => v },
  })
  archiveBytes!: number;

  @Column({ name: "stored_in", type: "varchar", length: 255, default: "" })
  storedIn!: string;

  @Column({ name: "offsite_target", type: "varchar", length: 255, default: "" })
  offsiteTarget!: string;

  @Column({ name: "offsite_sent", type: "tinyint", width: 1, default: 0 })
  offsiteSent!: number;

  @Column({ type: "mediumtext", select: false })
  log!: string;
}
