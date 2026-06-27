import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'VirtualAliases' })
export class VirtualAlias {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId!: number | null

  @Column({ name: 'domain', type: 'varchar', length: 255 })
  domain!: string

  @Column({ name: 'source', type: 'varchar', length: 255, unique: true })
  source!: string

  @Column({ name: 'destination', type: 'varchar', length: 255 })
  destination!: string

  @Column({ name: 'user_start_date', type: 'date' })
  userStartDate!: string

  @Column({ name: 'user_end_date', type: 'date', nullable: true })
  userEndDate!: string | null

  @Column({ name: 'last_activity', type: 'datetime' })
  lastActivity!: Date
}
