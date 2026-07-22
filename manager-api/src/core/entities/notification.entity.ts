import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Account } from "./account.entity";

@Index("idx_notifications_account_id", ["accountId"])
@Index("idx_notifications_account_read", ["accountId", "readAt"])
@Entity({ name: "notifications" })
export class Notification {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @Column({ name: "source", type: "varchar", length: 32 })
  source!: string;

  @Column({ name: "type", type: "varchar", length: 64 })
  type!: string;

  @Column({ name: "payload", type: "simple-json", nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ name: "link", type: "varchar", length: 512, nullable: true })
  link!: string | null;

  @Column({ name: "read_at", type: "datetime", nullable: true })
  readAt!: Date | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
