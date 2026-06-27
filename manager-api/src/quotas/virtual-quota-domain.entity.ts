import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'VirtualQuotaDomains' })
export class VirtualQuotaDomain {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number

  @Column({ name: 'domain', type: 'varchar', length: 255 })
  domain!: string

  @Column({ name: 'bytes', type: 'bigint', default: 0 })
  bytes!: string

  @Column({ name: 'messages', type: 'bigint', default: 0 })
  messages!: string

  @Column({ name: 'last_activity', type: 'datetime' })
  lastActivity!: Date
}
