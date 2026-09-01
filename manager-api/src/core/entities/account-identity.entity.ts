import { BeforeInsert, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from "typeorm";
import { randomUUID } from "crypto";
import { Account } from "./account.entity";

// One external identity an account signs in with: a provider id and the subject
// that provider gave it. The unique on (provider, subject) is what keeps one
// external identity from reaching two accounts. An account with no row here is
// password-only; an account may carry several, one per provider it has linked.
//
// Deliberately a table and not a column on `accounts`: a second provider must
// never be a schema change.
@Unique("uq_account_identities_provider_subject", ["provider", "subject"])
@Index("idx_account_identities_account_id", ["accountId"])
@Entity({ name: "account_identities" })
export class AccountIdentity {
  @PrimaryColumn({ name: "id", type: "char", length: 36 })
  id!: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_account_identities_account_id" })
  account!: Account;

  // The provider id from the catalog (oauth-providers.ts), e.g. "google".
  @Column({ name: "provider", type: "varchar", length: 32 })
  provider!: string;

  // The provider's own identifier for this person: the only value a provider
  // promises never to change or reassign, which is why the link is kept on it
  // rather than on the email address.
  @Column({ name: "subject", type: "varchar", length: 255 })
  subject!: string;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
