import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";

// What the sign-in guard remembers of one account, one row at most: the place it
// usually signs in from, and the question that lets it back in when there is
// neither an authenticator app nor a mail server to ask.
//
// Deliberately not on `account_profiles`: the coordinates there are the ones
// Nominatim found for the profile's city, an address, and this row is a
// security memory that walks with its owner. Deliberately not on `accounts`
// either, which the whole application reads on every request.
@Entity({ name: "account_mfa" })
export class AccountMfa {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @OneToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_account_mfa_account_id" })
  account!: Account;

  // Where the last accepted sign-in came from. Posed by the first one, moved by
  // every one after it, so the point walks with the account rather than pinning
  // it to wherever it first appeared.
  @Column({ name: "login_latitude", type: "decimal", precision: 10, scale: 7, nullable: true })
  loginLatitude!: string | null;

  @Column({ name: "login_longitude", type: "decimal", precision: 10, scale: 7, nullable: true })
  loginLongitude!: string | null;

  @Column({ name: "login_seen_at", type: "datetime", nullable: true })
  loginSeenAt!: Date | null;

  // The question in clear, since the answer is what proves anything and the
  // question has to be readable to be answered.
  @Column({ name: "question", type: "varchar", length: 255, nullable: true })
  question!: string | null;

  // HMAC-SHA256 of the normalised answer, keyed with the pepper: a dump alone
  // must not yield "Joel" to a dictionary run over first names.
  @Column({ name: "answer_hash", type: "varchar", length: 255, nullable: true })
  answerHash!: string | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "datetime", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
