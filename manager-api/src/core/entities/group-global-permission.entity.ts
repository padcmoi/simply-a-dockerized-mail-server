import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "group_global_permissions" })
export class GroupGlobalPermission {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "group_id", type: "char", length: 36 })
  groupId!: string;

  @Column({ name: "resource", type: "varchar", length: 64 })
  resource!: string;

  @Column({ name: "action", type: "varchar", length: 64 })
  action!: string;
}
