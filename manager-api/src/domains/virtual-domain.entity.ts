import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'VirtualDomains' })
export class VirtualDomain {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId!: number | null

  @Column({ name: 'domain', type: 'varchar', length: 255, unique: true })
  domain!: string

  @Column({ name: 'quota', type: 'bigint', default: 0 })
  quota!: string

  @Column({ name: 'active', type: 'tinyint', default: 0 })
  active!: number

  @Column({ name: 'user_start_date', type: 'date' })
  userStartDate!: string

  @Column({ name: 'user_end_date', type: 'date', nullable: true })
  userEndDate!: string | null

  @Column({ name: 'last_activity', type: 'timestamp' })
  lastActivity!: Date
}
