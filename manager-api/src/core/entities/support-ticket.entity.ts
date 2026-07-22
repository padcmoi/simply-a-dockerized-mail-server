import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Account } from "./account.entity";
import { VirtualDomain } from "./virtual-domain.entity";

@Index("idx_support_tickets_domain_id", ["domainId"])
@Entity({ name: "support_tickets" })
export class SupportTicket {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "domain_id", type: "int" })
  domainId!: number;

  @ManyToOne(() => VirtualDomain, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "domain_id" })
  domain!: VirtualDomain;

  @Column({ name: "created_by", type: "char", length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "CASCADE" })
  @JoinColumn({ name: "created_by" })
  creator!: Account | null;

  @Column({ name: "assigned_to", type: "char", length: 36, nullable: true })
  assignedTo!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "CASCADE" })
  @JoinColumn({ name: "assigned_to" })
  assignee!: Account | null;

  @Column({ name: "subject", type: "varchar", length: 255 })
  subject!: string;

  @Column({ name: "status", type: "varchar", length: 20, default: "open" })
  status!: string;

  @Column({ name: "visibility", type: "varchar", length: 10, default: "private" })
  visibility!: string;

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
