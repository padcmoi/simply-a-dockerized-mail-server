import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from "typeorm";
import { Account } from "./account.entity";
import { randomUUID } from "crypto";

@Unique("uq_groups_name", ["name"])
@Entity({ name: "groups" })
export class Group {
  // Opaque, same reasoning as Account.id: it travels in /groups/:id.
  @PrimaryColumn({ name: "id", type: "char", length: 36 })
  id!: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: "name", type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "description", type: "varchar", length: 1024, nullable: true })
  description!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "owner_id", foreignKeyConstraintName: "fk_groups_owner" })
  owner!: Account | null;

  @Column({ name: "owner_id", type: "char", length: 36, nullable: true })
  ownerId!: string | null;

  // Only one group in the whole table may have this set at a time; enforced
  // at the service level (see GroupsService), not via a DB constraint --
  // MariaDB partial unique indexes aren't reliable here.
  @Column({ name: "is_default", type: "tinyint", width: 1, default: 0 })
  isDefault!: number;

  // A protected group can never be deleted, by anyone (root included). The rule
  // lives in @naskot/custom-permission-guard (deleteGroup) and is honoured on
  // GroupsService's raw-delete path too. Toggling it is root-only, not an ACL.
  @Column({ name: "is_protected", type: "tinyint", width: 1, default: 0 })
  isProtected!: number;

  // A root-only "extra protection": an invisible group is completely hidden from
  // every non-root account (list + detail + every sub-resource all 404),
  // regardless of membership/ownership/held permissions. Pure app-side policy in
  // GroupsService, stricter than and orthogonal to the access-gating. Toggling
  // it is root-only, not an ACL.
  @Column({ name: "is_invisible", type: "tinyint", width: 1, default: 0 })
  isInvisible!: number;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
