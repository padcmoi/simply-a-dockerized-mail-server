import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Group } from "./group.entity";

@Unique("uq_group_global_permissions", ["groupId", "resource", "action"])
@Entity({ name: "group_global_permissions" })
export class GroupGlobalPermission {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "group_id", type: "char", length: 36 })
  groupId!: string;

  @ManyToOne(() => Group, { onDelete: "CASCADE", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "group_id", foreignKeyConstraintName: "fk_group_global_permissions_group" })
  group!: Group;

  @Column({ name: "resource", type: "varchar", length: 64 })
  resource!: string;

  @Column({ name: "action", type: "varchar", length: 64 })
  action!: string;
}
