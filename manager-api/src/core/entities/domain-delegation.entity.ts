import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Account } from "./account.entity";
import { VirtualDomain } from "./virtual-domain.entity";

// One account's granted allowance on one domain: how many recipients and
// aliases it may create for itself (NULL = unlimited) and the disk ceiling its
// mailboxes may reserve together (quota_mb, never unlimited: every grant is
// bounded by what the domain really has).
@Index("idx_domain_delegations_domain_id", ["domainId"])
@Index("idx_domain_delegations_created_by", ["createdBy"])
@Index("uq_domain_delegations_account_domain", ["accountId", "domainId"], { unique: true })
@Entity({ name: "domain_delegations" })
export class DomainDelegation {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_domain_delegations_account_id" })
  account!: Account;

  @Column({ name: "domain_id", type: "int" })
  domainId!: number;

  @ManyToOne(() => VirtualDomain, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "domain_id", foreignKeyConstraintName: "fk_domain_delegations_domain_id" })
  domain!: VirtualDomain;

  @Column({ name: "max_recipients", type: "int", nullable: true })
  maxRecipients!: number | null;

  @Column({ name: "max_aliases", type: "int", nullable: true })
  maxAliases!: number | null;

  @Column({ name: "quota_mb", type: "int" })
  quotaMb!: number;

  // Snapshot of the account's counts on this domain at grant time: only what
  // stands beyond these baselines spends the allowance, so a grant of N always
  // allows N new resources whatever the account already owned. Every fresh
  // grant (direct or via invitation/token) takes a new snapshot.
  @Column({ name: "base_recipients", type: "int", default: 0 })
  baseRecipients!: number;

  @Column({ name: "base_aliases", type: "int", default: 0 })
  baseAliases!: number;

  @Column({ name: "base_bytes", type: "bigint", width: 20, default: 0 })
  baseBytes!: string;

  @Column({ name: "created_by", type: "char", length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "CASCADE" })
  @JoinColumn({ name: "created_by", foreignKeyConstraintName: "fk_domain_delegations_created_by" })
  creator!: Account | null;

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
