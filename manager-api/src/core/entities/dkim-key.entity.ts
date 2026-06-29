import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { VirtualDomain } from "./virtual-domain.entity";

@Index("idx_dkim_keys_domain", ["domain"])
@Index("uq_dkim_keys_domain_selector", ["domain", "selector"], { unique: true })
@Entity({ name: "dkim_keys" })
export class DkimKeyEntity {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "domain", type: "varchar", length: 255 })
  domain!: string;

  @ManyToOne(() => VirtualDomain, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "domain", referencedColumnName: "domain" })
  domainRef!: VirtualDomain;

  @Column({ name: "selector", type: "varchar", length: 255 })
  selector!: string;

  @Column({ name: "dns_name", type: "varchar", length: 512 })
  dnsName!: string;

  @Column({ name: "public_key", type: "text" })
  publicKey!: string;

  @Column({ name: "txt_record", type: "text" })
  txtRecord!: string;

  @Column({ name: "private_key_path", type: "varchar", length: 512, nullable: true })
  privateKeyPath!: string | null;

  @Column({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}
