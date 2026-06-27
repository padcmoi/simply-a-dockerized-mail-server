import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'VirtualUsers' })
export class VirtualUser {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId!: number | null

  @Column({ name: 'domain', type: 'varchar', length: 255 })
  domain!: string

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email!: string

  @Column({ name: 'password', type: 'varchar', length: 128 })
  password!: string

  @Column({ name: 'maildir', type: 'char', length: 50 })
  maildir!: string

  @Column({ name: 'quota', type: 'bigint', default: 0 })
  quota!: string

  @Column({ name: 'active', type: 'tinyint', default: 0 })
  active!: number

  @Column({ name: 'uid', type: 'char', length: 15, default: 'vmail' })
  uid!: string

  @Column({ name: 'gid', type: 'char', length: 15, default: 'vmail' })
  gid!: string

  @Column({ name: 'user_start_date', type: 'date' })
  userStartDate!: string

  @Column({ name: 'user_end_date', type: 'date', nullable: true })
  userEndDate!: string | null

  @Column({ name: 'last_activity', type: 'timestamp', nullable: true })
  lastActivity!: Date | null
}
