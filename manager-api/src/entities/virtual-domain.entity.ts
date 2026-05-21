import { Column, Entity, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './account.entity';

const bigintTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : parseInt(value, 10)),
};

@Entity('VirtualDomains')
@Index('domain_2', ['domain'])
export class VirtualDomain {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  owner_id!: number | null;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: Account | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  domain!: string;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  quota!: number;

  @Column({ type: 'tinyint', default: 0 })
  active!: number;

  @Column({ type: 'date', default: () => "'1970-01-01'" })
  user_start_date!: string;

  @Column({ type: 'date', nullable: true })
  user_end_date!: string | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  last_activity!: Date;
}
