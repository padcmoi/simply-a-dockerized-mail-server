import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Account } from "./account.entity";
import { Group } from "./group.entity";

// An account can belong to zero, one, or several groups (join table).
@Unique("uq_group_members_group_account", ["groupId", "accountId"])
@Entity({ name: "group_members" })
export class GroupMember {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "group_id", type: "char", length: 36 })
  groupId!: string;

  @ManyToOne(() => Group, { onDelete: "CASCADE", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "group_id", foreignKeyConstraintName: "fk_group_members_group" })
  group!: Group;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "account_id", foreignKeyConstraintName: "fk_group_members_account" })
  account!: Account;

  @Column({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
