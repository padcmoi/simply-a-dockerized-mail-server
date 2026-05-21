import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 1.x.x prod table. `username` is the login identifier (email-like) and the FK
 * target for VirtualDomains.owner_id / VirtualUsers.owner_id / VirtualAliases.owner_id.
 * Login columns (password_hash, role, is_active, ...) are additive and nullable so
 * existing rows without credentials remain valid FK targets without login capability.
 */
@Entity('Accounts')
export class Account {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string;

  /** SHA512-CRYPT (`$6$salt$hash`) - same scheme as Dovecot mailbox passwords. Null = no login. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  password_hash!: string | null;

  @Column({ type: 'enum', enum: ['root', 'admin', 'owner', 'user'], default: 'user' })
  @Index()
  role!: 'root' | 'admin' | 'owner' | 'user';

  @Column({ type: 'tinyint', default: 1 })
  is_active!: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', nullable: true })
  created_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  last_login_at!: Date | null;
}
