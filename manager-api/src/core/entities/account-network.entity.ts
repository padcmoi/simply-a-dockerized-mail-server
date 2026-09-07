import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";

@Entity({ name: "account_networks" })
export class AccountNetwork {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @PrimaryColumn({ name: "country_code", type: "char", length: 2 })
  countryCode!: string;

  @PrimaryColumn({ name: "asn", type: "int", unsigned: true })
  asn!: number;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_account_networks_account_id" })
  account!: Account;

  @Column({ name: "asn_org", type: "varchar", length: 128, nullable: true })
  asnOrg!: string | null;

  @Column({ name: "last_city", type: "varchar", length: 64, nullable: true })
  lastCity!: string | null;

  @Column({ name: "last_ip", type: "varchar", length: 45, nullable: true })
  lastIp!: string | null;

  @Column({ name: "login_count", type: "int", unsigned: true, default: 1 })
  loginCount!: number;

  @Column({ name: "first_seen_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  firstSeenAt!: Date;

  @Column({ name: "last_seen_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  lastSeenAt!: Date;
}
