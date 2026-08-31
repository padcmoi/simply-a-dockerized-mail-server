import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Group } from "./group.entity";
import { VirtualDomain } from "./virtual-domain.entity";

@Unique("uq_group_domain_permissions", ["groupId", "domainId", "resource", "action"])
@Entity({ name: "group_domain_permissions" })
export class GroupDomainPermission {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "group_id", type: "char", length: 36 })
  groupId!: string;

  @ManyToOne(() => Group, { onDelete: "CASCADE", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "group_id", foreignKeyConstraintName: "fk_group_domain_permissions_group" })
  group!: Group;

  @Column({ name: "domain_id", type: "int" })
  domainId!: number;

  @ManyToOne(() => VirtualDomain, { onDelete: "CASCADE", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "domain_id", foreignKeyConstraintName: "fk_group_domain_permissions_domain" })
  domain!: VirtualDomain;

  @Column({ name: "resource", type: "varchar", length: 64 })
  resource!: string;

  @Column({ name: "action", type: "varchar", length: 64 })
  action!: string;
}
