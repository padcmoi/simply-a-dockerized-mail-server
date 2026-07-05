import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "group_domain_permissions" })
export class GroupDomainPermission {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "group_id", type: "int" })
  groupId!: number;

  @Column({ name: "domain_id", type: "int" })
  domainId!: number;

  @Column({ name: "resource", type: "varchar", length: 64 })
  resource!: string;

  @Column({ name: "action", type: "varchar", length: 64 })
  action!: string;
}
