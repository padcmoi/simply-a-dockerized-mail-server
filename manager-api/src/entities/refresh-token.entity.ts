import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './account.entity';

/**
 * Persistent refresh token store - one row per issued refresh JWT.
 * The token itself is never stored ; only its `jti` claim is. Refresh requests look
 * up the jti and check `revoked_at IS NULL AND expires_at > NOW()`. Rotation marks
 * the old row revoked and inserts a fresh one with a new jti.
 */
@Entity('RefreshTokens')
export class RefreshToken {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 36, unique: true })
  jti!: string;

  @Column({ type: 'int' })
  @Index()
  account_id!: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ type: 'datetime' })
  @Index()
  expires_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  revoked_at!: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  last_used_at!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;
}
