import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "accounts" })
export class Account {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "username", type: "varchar", length: 255, unique: true })
  username!: string;

  @Column({ name: "name", type: "varchar", length: 255, nullable: true })
  name!: string | null;

  @Column({ name: "email", type: "varchar", length: 255, nullable: true, unique: true })
  email!: string | null;

  @Column({ name: "avatar_url", type: "varchar", length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: "password", type: "varchar", length: 255, nullable: true })
  password!: string | null;

  // 1 for the install-time super-admin (seeded by install.sh), 0 for every
  // account created afterwards. Finer-grained permissions belong to a future
  // ACL table; this flag stays on the row only to identify the bootstrap user.
  @Column({ name: "is_root", type: "tinyint", width: 1, default: 0 })
  isRoot!: number;

  @Column({ name: "enabled", type: "tinyint", width: 1, default: 1 })
  enabled!: number;

  @Column({ name: "last_login", type: "datetime", nullable: true })
  lastLogin!: Date | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}
