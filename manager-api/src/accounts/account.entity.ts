import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'Accounts' })
export class Account {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int' })
  id!: number

  @Column({ name: 'username', type: 'varchar', length: 255, unique: true })
  username!: string

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true })
  password!: string | null

  @Column({ name: 'role', type: 'varchar', length: 32, default: 'admin' })
  role!: string

  @Column({ name: 'enabled', type: 'tinyint', width: 1, default: 1 })
  enabled!: number

  @Column({ name: 'last_login', type: 'datetime', nullable: true })
  lastLogin!: Date | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date

  @Column({
    name: 'updated_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date
}
