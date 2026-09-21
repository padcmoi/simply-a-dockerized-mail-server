import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { DmarcIncomingRecord } from "./dmarc-incoming-record.entity";

const epoch = { from: (value: string | number | null) => (value === null ? value : Number(value)), to: (value: number) => value };

@Entity({ name: "dmarc_incoming_reports" })
@Unique("uq_dmarc_incoming_org_report", ["orgName", "reportId"])
@Index("idx_dmarc_incoming_domain_begin", ["domain", "periodBegin"])
export class DmarcIncomingReport {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Column({ name: "org_name", type: "varchar", length: 255 })
  orgName!: string;

  @Column({ name: "org_email", type: "varchar", length: 320 })
  orgEmail!: string;

  @Column({ name: "extra_contact", type: "varchar", length: 512, nullable: true })
  extraContact!: string | null;

  @Column({ name: "report_id", type: "varchar", length: 255 })
  reportId!: string;

  @Column({ name: "domain", type: "varchar", length: 255 })
  domain!: string;

  @Column({ name: "period_begin", type: "bigint", transformer: epoch })
  periodBegin!: number;

  @Column({ name: "period_end", type: "bigint", transformer: epoch })
  periodEnd!: number;

  @Column({ name: "adkim", type: "char", length: 1 })
  adkim!: string;

  @Column({ name: "aspf", type: "char", length: 1 })
  aspf!: string;

  @Column({ name: "p", type: "varchar", length: 16 })
  p!: string;

  @Column({ name: "sp", type: "varchar", length: 16 })
  sp!: string;

  @Column({ name: "pct", type: "smallint" })
  pct!: number;

  @Column({ name: "records", type: "int" })
  records!: number;

  @Column({ name: "messages", type: "int" })
  messages!: number;

  @Column({ name: "dmarc_pass", type: "int" })
  dmarcPass!: number;

  @Column({ name: "dkim_pass", type: "int" })
  dkimPass!: number;

  @Column({ name: "spf_pass", type: "int" })
  spfPass!: number;

  @Column({ name: "mailbox", type: "varchar", length: 320 })
  mailbox!: string;

  @Column({ name: "xml", type: "mediumtext" })
  xml!: string;

  @Index("idx_dmarc_incoming_received")
  @CreateDateColumn({ name: "received_at", type: "datetime" })
  receivedAt!: Date;

  @OneToMany(() => DmarcIncomingRecord, (record) => record.report)
  rows?: DmarcIncomingRecord[];
}
