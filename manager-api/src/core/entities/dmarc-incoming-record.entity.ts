import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { DmarcReportRecord } from "../dmarc/dmarc.types";
import { DmarcIncomingReport } from "./dmarc-incoming-report.entity";

@Entity({ name: "dmarc_incoming_records" })
export class DmarcIncomingRecord {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Column({ name: "report_id", type: "int" })
  reportId!: number;

  @ManyToOne(() => DmarcIncomingReport, (report) => report.rows, { onDelete: "CASCADE" })
  @JoinColumn({ name: "report_id" })
  report?: DmarcIncomingReport;

  @Column({ name: "source_ip", type: "varchar", length: 45 })
  sourceIp!: string;

  @Column({ name: "count", type: "int" })
  count!: number;

  @Column({ name: "disposition", type: "varchar", length: 16 })
  disposition!: string;

  @Column({ name: "dkim", type: "varchar", length: 8 })
  dkim!: string;

  @Column({ name: "spf", type: "varchar", length: 8 })
  spf!: string;

  @Column({ name: "header_from", type: "varchar", length: 255 })
  headerFrom!: string;

  @Column({ name: "envelope_from", type: "varchar", length: 255, nullable: true })
  envelopeFrom!: string | null;

  @Column({ name: "envelope_to", type: "varchar", length: 255, nullable: true })
  envelopeTo!: string | null;

  @Column({ name: "dkim_results", type: "json" })
  dkimResults!: DmarcReportRecord["dkimResults"];

  @Column({ name: "spf_results", type: "json" })
  spfResults!: DmarcReportRecord["spfResults"];

  @Column({ name: "reasons", type: "json" })
  reasons!: DmarcReportRecord["reasons"];
}
