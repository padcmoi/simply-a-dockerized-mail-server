import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './account.entity';
import { VirtualDomain } from './virtual-domain.entity';

const bigintTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : parseInt(value, 10)),
};

@Entity('VirtualUsers')
export class VirtualUser {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  owner_id!: number | null;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: Account | null;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  domain!: string;

  @ManyToOne(() => VirtualDomain, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'domain', referencedColumnName: 'domain' })
  domainRef?: VirtualDomain;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** Dovecot SHA512-CRYPT hash ($6$salt$hash). Mailbox auth, NOT webadmin auth. */
  @Column({ type: 'varchar', length: 128 })
  password!: string;

  /** Format `<domain>/<localpart>/` - mounted under /var/mail/vhosts/ at runtime. */
  @Column({ type: 'char', length: 50 })
  maildir!: string;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  quota!: number;

  @Column({ type: 'tinyint', default: 0 })
  active!: number;

  @Column({ type: 'char', length: 15, default: 'vmail' })
  uid!: string;

  @Column({ type: 'char', length: 15, default: 'vmail' })
  gid!: string;

  @Column({ type: 'date', default: () => "'1970-01-01'" })
  user_start_date!: string;

  @Column({ type: 'date', nullable: true })
  user_end_date!: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  last_activity!: Date | null;
}
