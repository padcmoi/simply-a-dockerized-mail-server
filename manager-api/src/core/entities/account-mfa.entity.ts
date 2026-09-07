import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";

@Entity({ name: "account_mfa" })
export class AccountMfa {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @OneToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_account_mfa_account_id" })
  account!: Account;

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
