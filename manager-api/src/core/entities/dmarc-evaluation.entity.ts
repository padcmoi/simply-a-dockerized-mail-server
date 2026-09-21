import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { DkimSignature } from "../dmarc/dmarc.types";

const epoch = { from: (value: string | number | null) => (value === null ? value : Number(value)), to: (value: number) => value };

@Entity({ name: "dmarc_evaluations" })
@Index("idx_dmarc_evaluations_domain_received", ["policyDomain", "receivedAt"])
export class DmarcEvaluation {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Index("idx_dmarc_evaluations_received")
  @Column({ name: "received_at", type: "bigint", transformer: epoch })
  receivedAt!: number;

  @Index("idx_dmarc_evaluations_job")
  @Column({ name: "job_id", type: "varchar", length: 64 })
  jobId!: string;

  @Column({ name: "reporter", type: "varchar", length: 255 })
  reporter!: string;

  @Column({ name: "source_ip", type: "varchar", length: 45 })
  sourceIp!: string;

  @Column({ name: "header_from", type: "varchar", length: 255 })
  headerFrom!: string;

  @Column({ name: "envelope_from", type: "varchar", length: 255, nullable: true })
  envelopeFrom!: string | null;

  @Column({ name: "policy_domain", type: "varchar", length: 255 })
  policyDomain!: string;

  @Column({ name: "spf_result", type: "varchar", length: 16 })
  spfResult!: string;

  @Column({ name: "dkim", type: "json" })
  dkim!: DkimSignature[];

  @Column({ name: "dkim_aligned", type: "varchar", length: 8 })
  dkimAligned!: string;

  @Column({ name: "spf_aligned", type: "varchar", length: 8 })
  spfAligned!: string;

  @Column({ name: "disposition", type: "varchar", length: 16 })
  disposition!: string;

  @Column({ name: "policy", type: "varchar", length: 16, nullable: true })
  policy!: string | null;

  @Column({ name: "subdomain_policy", type: "varchar", length: 16, nullable: true })
  subdomainPolicy!: string | null;

  @Column({ name: "adkim", type: "char", length: 1 })
  adkim!: string;

  @Column({ name: "aspf", type: "char", length: 1 })
  aspf!: string;

  @Column({ name: "pct", type: "smallint" })
  pct!: number;

  @Column({ name: "rua", type: "json" })
  rua!: string[];

  @Column({ name: "recipient_domain", type: "varchar", length: 255, nullable: true })
  recipientDomain!: string | null;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}
