import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";

// One-to-one profile for an account: every personal / non-auth attribute lives
// here, keeping `accounts` to strictly what authentication needs (id, email,
// password, is_root, enabled). Shares the account id as its primary key, no
// surrogate, and cascades away with the account.
@Entity({ name: "account_profiles" })
export class AccountProfile {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @OneToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @Column({ name: "display_name", type: "varchar", length: 255, nullable: true })
  displayName!: string | null;

  @Column({ name: "avatar_url", type: "varchar", length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: "phone", type: "varchar", length: 32, nullable: true })
  phone!: string | null;

  @Column({ name: "address_line", type: "varchar", length: 255, nullable: true })
  addressLine!: string | null;

  @Column({ name: "address_complement", type: "varchar", length: 255, nullable: true })
  addressComplement!: string | null;

  @Column({ name: "city", type: "varchar", length: 255, nullable: true })
  city!: string | null;

  @Column({ name: "postal_code", type: "varchar", length: 32, nullable: true })
  postalCode!: string | null;

  @Column({ name: "country", type: "varchar", length: 255, nullable: true })
  country!: string | null;

  // Geocoded from `city` when it is set (see the geocoding step). decimal(10,7)
  // gives ~1cm precision, far more than a city centroid needs. TypeORM surfaces
  // MariaDB DECIMAL as a string to avoid float rounding, hence `string | null`.
  @Column({ name: "latitude", type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ name: "longitude", type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

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
