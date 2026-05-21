import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Existing prod schema - DO NOT modify columns/constraints.
 * FK target for VirtualDomains.owner_id / VirtualUsers.owner_id / VirtualAliases.owner_id.
 */
@Entity('Accounts')
export class Account {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string;
}
