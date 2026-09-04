import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";

// The second factor of one account, one row at most. A row with no
// `enabledAt` is a setup under way: the secret has been shown, not yet proved
// with a code, and the account signs in exactly as before until it is.
@Entity({ name: "account_two_factor" })
export class AccountTwoFactor {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @OneToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_account_two_factor_account_id" })
  account!: Account;

  // The TOTP secret, sealed with the pepper like a provider's client secret: a
  // database dump alone must not yield what computes every code.
  @Column({ name: "secret_cipher", type: "varchar", length: 512 })
  secretCipher!: string;

  @Column({ name: "enabled_at", type: "datetime", nullable: true })
  enabledAt!: Date | null;

  // The time step of the last code accepted, so the same code is never
  // accepted twice within its window.
  @Column({ name: "last_used_step", type: "bigint", nullable: true })
  lastUsedStep!: string | null;

  // SHA-256 of each recovery code still unused; a used one is removed.
  @Column({ name: "recovery_codes", type: "json" })
  recoveryCodes!: string[];

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "datetime", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
