import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "backup_files" })
export class BackupFile {
  @PrimaryColumn({ type: "varchar", length: 64 })
  name!: string;

  @Column({ type: "bigint", default: 0, transformer: { from: (v: string | number) => Number(v), to: (v: number) => v } })
  bytes!: number;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "local_present", type: "tinyint", width: 1, default: 0 })
  localPresent!: number;

  @Column({ name: "local_dir", type: "varchar", length: 255, default: "" })
  localDir!: string;

  @Column({ name: "local_project_dir", type: "varchar", length: 255, nullable: true })
  localProjectDir!: string | null;

  @Column({ name: "local_deleted_at", type: "datetime", nullable: true })
  localDeletedAt!: Date | null;

  @Column({ name: "offsite_target", type: "varchar", length: 255, default: "" })
  offsiteTarget!: string;

  @Column({ name: "offsite_sent_at", type: "datetime", nullable: true })
  offsiteSentAt!: Date | null;

  @Column({ name: "offsite_deleted_at", type: "datetime", nullable: true })
  offsiteDeletedAt!: Date | null;
}
