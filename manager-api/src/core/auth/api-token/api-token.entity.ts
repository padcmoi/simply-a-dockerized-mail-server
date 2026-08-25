import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Account } from "../../entities/account.entity";

@Entity({ name: "api_tokens" })
export class ApiToken {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @Column({ name: "name", type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "client_id", type: "varchar", length: 64, unique: true })
  clientId!: string;

  @Column({ name: "secret_hash", type: "varchar", length: 255 })
  secretHash!: string;

  @Column({ name: "secret_cipher", type: "varchar", length: 512, default: "" })
  secretCipher!: string;

  @Column({ name: "allowed_ips", type: "text", nullable: true })
  allowedIps!: string | null;

  @Column({ name: "expires_at", type: "datetime", nullable: true })
  expiresAt!: Date | null;

  @Column({ name: "failed_attempts", type: "int", default: 0 })
  failedAttempts!: number;

  @Column({ name: "locked_until", type: "datetime", nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: "revoked_at", type: "datetime", nullable: true })
  revokedAt!: Date | null;

  @Column({ name: "last_used_at", type: "datetime", nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: "last_used_ip", type: "varchar", length: 45, nullable: true })
  lastUsedIp!: string | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
