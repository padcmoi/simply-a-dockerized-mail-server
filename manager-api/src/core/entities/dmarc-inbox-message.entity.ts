import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "dmarc_inbox_messages" })
@Unique("uq_dmarc_inbox_mailbox_key", ["mailbox", "messageKey"])
export class DmarcInboxMessage {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Column({ name: "mailbox", type: "varchar", length: 320 })
  mailbox!: string;

  @Column({ name: "message_key", type: "varchar", length: 255 })
  messageKey!: string;

  @Column({ name: "status", type: "varchar", length: 16 })
  status!: string;

  @Column({ name: "detail", type: "varchar", length: 1024, nullable: true })
  detail!: string | null;

  @Column({ name: "message_id", type: "varchar", length: 512, nullable: true })
  messageId!: string | null;

  @Column({ name: "sender", type: "varchar", length: 320, nullable: true })
  sender!: string | null;

  @Column({ name: "subject", type: "varchar", length: 512, nullable: true })
  subject!: string | null;

  @Column({ name: "reports", type: "int", default: 0 })
  reports!: number;

  @Index("idx_dmarc_inbox_scanned")
  @CreateDateColumn({ name: "scanned_at", type: "datetime" })
  scannedAt!: Date;
}
