import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { VirtualDomain } from '../domains/virtual-domain.entity'
import { VirtualUser } from '../users/virtual-user.entity'

@Entity({ name: 'VirtualQuotaUsers' })
export class VirtualQuotaUser {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int' })
  id!: number

  @Column({ name: 'domain', type: 'varchar', length: 255 })
  domain!: string

  @ManyToOne(() => VirtualDomain, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'domain', referencedColumnName: 'domain' })
  domainRef!: VirtualDomain

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string

  @ManyToOne(() => VirtualUser, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'email', referencedColumnName: 'email' })
  userRef!: VirtualUser

  @Column({ name: 'bytes', type: 'bigint', width: 20, default: 0 })
  bytes!: string

  @Column({ name: 'messages', type: 'bigint', width: 20, default: 0 })
  messages!: string

  @Column({
    name: 'last_activity',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  lastActivity!: Date
}
