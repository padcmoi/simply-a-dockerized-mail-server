import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

const epoch = { from: (value: string | number | null) => (value === null ? value : Number(value)), to: (value: number) => value };

@Entity({ name: "dmarc_outgoing_reports" })
@Unique("uq_dmarc_outgoing_report_recipient", ["reportId", "recipient"])
export class DmarcOutgoingReport {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Column({ name: "report_id", type: "varchar", length: 255 })
  reportId!: string;

  @Index("idx_dmarc_outgoing_reporter")
  @Column({ name: "reporter_domain", type: "varchar", length: 255 })
  reporterDomain!: string;

  @Index("idx_dmarc_outgoing_domain")
  @Column({ name: "policy_domain", type: "varchar", length: 255 })
  policyDomain!: string;

  @Column({ name: "recipient", type: "varchar", length: 320 })
  recipient!: string;

  @Column({ name: "period_begin", type: "bigint", transformer: epoch })
  periodBegin!: number;

  @Column({ name: "period_end", type: "bigint", transformer: epoch })
  periodEnd!: number;

  @Column({ name: "records", type: "int" })
  records!: number;

  @Column({ name: "messages", type: "int" })
  messages!: number;

  @Column({ name: "size_bytes", type: "int" })
  sizeBytes!: number;

  @Column({ name: "status", type: "varchar", length: 16 })
  status!: string;

  @Column({ name: "reason", type: "varchar", length: 1024, nullable: true })
  reason!: string | null;

  @Column({ name: "attempts", type: "int", default: 0 })
  attempts!: number;

  @Column({ name: "xml", type: "mediumtext" })
  xml!: string;

  @Index("idx_dmarc_outgoing_created")
  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @Column({ name: "sent_at", type: "datetime", nullable: true })
  sentAt!: Date | null;
}
