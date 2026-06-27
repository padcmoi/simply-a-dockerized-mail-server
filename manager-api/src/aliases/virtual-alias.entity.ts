import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { VirtualDomain } from "../domains/virtual-domain.entity";

@Index("owner_id", ["ownerId"])
@Entity({ name: "VirtualAliases" })
export class VirtualAlias {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "owner_id", type: "int", nullable: true })
  ownerId!: number | null;

  @Column({ name: "domain", type: "varchar", length: 255 })
  domain!: string;

  @ManyToOne(() => VirtualDomain, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "domain", referencedColumnName: "domain" })
  domainRef!: VirtualDomain;

  @Column({ name: "source", type: "varchar", length: 255, unique: true })
  source!: string;

  @Column({ name: "destination", type: "varchar", length: 255 })
  destination!: string;

  @Column({ name: "user_start_date", type: "date", default: () => "'1970-01-01'" })
  userStartDate!: string;

  @Column({ name: "user_end_date", type: "date", nullable: true })
  userEndDate!: string | null;

  @Column({
    name: "last_activity",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  lastActivity!: Date;
}
