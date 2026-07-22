import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";

@Entity({ name: "notification_preferences" })
export class NotificationPreference {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @PrimaryColumn({ name: "source", type: "varchar", length: 32 })
  source!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @Column({ name: "in_app", type: "tinyint", width: 1, default: 1 })
  inApp!: number;

  @Column({ name: "email", type: "tinyint", width: 1, default: 1 })
  email!: number;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}
