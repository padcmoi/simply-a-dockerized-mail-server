import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from './account.entity';

/**
 * Additive table bootstrapped by install.sh - holds the webadmin login credentials
 * (root + future admin/owner/user records). Distinct from `VirtualUsers` which holds
 * the IMAP/SMTP mailbox passwords.
 */
@Entity('webadmin_accounts')
export class WebadminAccount {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** SHA512-CRYPT hash (`$6$salt$hash`) - same scheme as Dovecot mailbox passwords. */
  @Column({ type: 'varchar', length: 128 })
  password_hash!: string;

  @Column({ type: 'enum', enum: ['root', 'admin', 'owner', 'user'], default: 'user' })
  @Index()
  role!: 'root' | 'admin' | 'owner' | 'user';

  @Column({ type: 'int', nullable: true })
  @Index()
  account_id!: number | null;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account | null;

  @Column({ type: 'tinyint', default: 1 })
  is_active!: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  last_login_at!: Date | null;
}
