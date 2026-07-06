import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// An account can belong to zero, one, or several groups (join table).
@Entity({ name: "group_members" })
export class GroupMember {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "group_id", type: "int" })
  groupId!: number;

  @Column({ name: "account_id", type: "int" })
  accountId!: number;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
