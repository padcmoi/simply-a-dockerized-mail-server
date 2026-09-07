import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";

@Entity({ name: "account_addresses" })
@Index("idx_account_addresses_last_seen_at", ["lastSeenAt"])
export class AccountAddress {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @PrimaryColumn({ name: "ip", type: "varchar", length: 45 })
  ip!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_account_addresses_account_id" })
  account!: Account;

  @Column({ name: "country_code", type: "char", length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ name: "asn", type: "int", unsigned: true, nullable: true })
  asn!: number | null;

  @Column({ name: "asn_org", type: "varchar", length: 128, nullable: true })
  asnOrg!: string | null;

  @Column({ name: "city", type: "varchar", length: 64, nullable: true })
  city!: string | null;

  @Column({ name: "latitude", type: "decimal", precision: 10, scale: 7 })
  latitude!: string;

  @Column({ name: "longitude", type: "decimal", precision: 10, scale: 7 })
  longitude!: string;

  @Column({ name: "login_count", type: "int", unsigned: true, default: 1 })
  loginCount!: number;

  @Column({ name: "first_seen_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  firstSeenAt!: Date;

  @Column({ name: "last_seen_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  lastSeenAt!: Date;
}
