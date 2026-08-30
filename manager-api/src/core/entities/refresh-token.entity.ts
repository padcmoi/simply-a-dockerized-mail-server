import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Account } from "./account.entity";

@Index("idx_refresh_tokens_account_id", ["accountId"])
@Unique("uq_refresh_tokens_token_hash", ["tokenHash"])
@Entity({ name: "refresh_tokens" })
export class RefreshToken {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_refresh_tokens_account_id" })
  account!: Account;

  @Column({ name: "token_hash", type: "varchar", length: 255 })
  tokenHash!: string;

  @Column({ name: "user_agent", type: "varchar", length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ name: "ip", type: "varchar", length: 45, nullable: true })
  ip!: string | null;

  @Column({ name: "expires_at", type: "datetime" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", type: "datetime", nullable: true })
  revokedAt!: Date | null;

  // Last time the session was used (the auth guard touches it on each request,
  // throttled). A session seen within the last minute is "online now".
  @Column({ name: "last_seen_at", type: "datetime", nullable: true })
  lastSeenAt!: Date | null;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
