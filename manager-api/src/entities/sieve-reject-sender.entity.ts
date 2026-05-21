import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('SieveRejectSenders')
export class SieveRejectSender {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  sender!: string;

  @Column({ type: 'int', default: 1 })
  enabled!: number;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  date_creation!: Date;
}
