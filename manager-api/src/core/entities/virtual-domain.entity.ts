import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("domain_2", ["domain"])
@Index("owner_id", ["ownerId"])
@Entity({ name: "virtual_domains" })
export class VirtualDomain {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "owner_id", type: "int", nullable: true })
  ownerId!: number | null;

  @Column({ name: "domain", type: "varchar", length: 255, unique: true })
  domain!: string;

  @Column({ name: "quota", type: "bigint", width: 20, default: 0 })
  quota!: string;

  @Column({ name: "active", type: "tinyint", width: 1, default: 0 })
  active!: number;

  @Column({ name: "user_start_date", type: "date", default: () => "'1970-01-01'" })
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
