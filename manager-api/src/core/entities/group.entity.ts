import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "groups" })
export class Group {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "name", type: "varchar", length: 255, unique: true })
  name!: string;

  @Column({ name: "description", type: "varchar", length: 1024, nullable: true })
  description!: string | null;

  @Column({ name: "owner_id", type: "int", nullable: true })
  ownerId!: number | null;

  // Only one group in the whole table may have this set at a time; enforced
  // at the service level (see GroupsService), not via a DB constraint --
  // MariaDB partial unique indexes aren't reliable here.
  @Column({ name: "is_default", type: "tinyint", width: 1, default: 0 })
  isDefault!: number;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
