import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Account } from '../accounts/account.entity'

@Entity({ name: 'RefreshTokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number

  @Column({ name: 'account_id', type: 'int' })
  accountId!: number

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account

  @Column({ name: 'token_hash', type: 'varchar', length: 255, unique: true })
  tokenHash!: string

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null

  @Column({ name: 'ip', type: 'varchar', length: 45, nullable: true })
  ip!: string | null

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt!: Date | null

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date
}
