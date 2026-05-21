import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VirtualDomain } from './virtual-domain.entity';

const bigintTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};

@Entity('VirtualQuotaDomains')
export class VirtualQuotaDomain {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  domain!: string;

  @ManyToOne(() => VirtualDomain, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'domain', referencedColumnName: 'domain' })
  domainRef?: VirtualDomain;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  bytes!: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  messages!: number;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  last_activity!: Date;
}
