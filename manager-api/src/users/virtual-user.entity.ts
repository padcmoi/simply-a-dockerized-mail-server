import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { VirtualDomain } from "../domains/virtual-domain.entity";

@Index("owner_id", ["ownerId"])
@Entity({ name: "virtual_users" })
export class VirtualUser {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "owner_id", type: "int", nullable: true })
  ownerId!: number | null;

  @Column({ name: "domain", type: "varchar", length: 255 })
  domain!: string;

  @ManyToOne(() => VirtualDomain, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "domain", referencedColumnName: "domain" })
  domainRef!: VirtualDomain;

  @Column({ name: "email", type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ name: "password", type: "varchar", length: 128 })
  password!: string;

  @Column({ name: "maildir", type: "char", length: 50 })
  maildir!: string;

  @Column({ name: "quota", type: "bigint", width: 20, default: 0 })
  quota!: string;

  @Column({ name: "active", type: "tinyint", width: 1, default: 0 })
  active!: number;

  @Column({ name: "uid", type: "char", length: 15, default: "vmail" })
  uid!: string;

  @Column({ name: "gid", type: "char", length: 15, default: "vmail" })
  gid!: string;

  @Column({ name: "user_start_date", type: "date", default: () => "'1970-01-01'" })
  userStartDate!: string;

  @Column({ name: "user_end_date", type: "date", nullable: true })
  userEndDate!: string | null;

  @Column({
    name: "last_activity",
    type: "timestamp",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  lastActivity!: Date | null;
}
