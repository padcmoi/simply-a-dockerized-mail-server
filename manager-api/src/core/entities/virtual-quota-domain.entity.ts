import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { VirtualDomain } from "./virtual-domain.entity";

@Index("idx_virtual_quota_domains_domain", ["domain"])
@Entity({ name: "virtual_quota_domains" })
export class VirtualQuotaDomain {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "domain", type: "varchar", length: 255 })
  domain!: string;

  @ManyToOne(() => VirtualDomain, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "domain", referencedColumnName: "domain", foreignKeyConstraintName: "fk_virtual_quota_domains_domain" })
  domainRef!: VirtualDomain;

  @Column({ name: "bytes", type: "bigint", width: 20, default: 0 })
  bytes!: string;

  @Column({ name: "messages", type: "bigint", width: 20, default: 0 })
  messages!: string;

  @Column({
    name: "last_activity",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  lastActivity!: Date;
}
