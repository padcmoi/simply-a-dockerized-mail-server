import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Account } from "./account.entity";

@Index("idx_virtual_domains_domain", ["domain"])
@Index("idx_virtual_domains_owner_id", ["ownerId"])
@Unique("uq_virtual_domains_domain", ["domain"])
@Entity({ name: "virtual_domains" })
export class VirtualDomain {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "owner_id", type: "char", length: 36, nullable: true })
  ownerId!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "owner_id", foreignKeyConstraintName: "fk_virtual_domains_owner" })
  owner!: Account | null;

  @Column({ name: "domain", type: "varchar", length: 255 })
  domain!: string;

  @Column({ name: "quota", type: "bigint", width: 20, default: 0 })
  quota!: string;

  @Column({ name: "active", type: "tinyint", width: 1, default: 0 })
  active!: number;

  @Column({
    name: "user_start_date",
    type: "date",
    default: () => "'1970-01-01'",
  })
  userStartDate!: string;

  @Column({ name: "user_end_date", type: "date", nullable: true })
  userEndDate!: string | null;

  @Column({
    name: "last_activity",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  lastActivity!: Date;
}
