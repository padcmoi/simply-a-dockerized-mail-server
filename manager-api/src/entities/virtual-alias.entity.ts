import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './account.entity';
import { VirtualDomain } from './virtual-domain.entity';

@Entity('VirtualAliases')
export class VirtualAlias {
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
  source!: string;

  @Column({ type: 'varchar', length: 255 })
  destination!: string;

  @Column({ type: 'date', default: () => "'1970-01-01'" })
  user_start_date!: string;

  @Column({ type: 'date', nullable: true })
  user_end_date!: string | null;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  last_activity!: Date;
}
