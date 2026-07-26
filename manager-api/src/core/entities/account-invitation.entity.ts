import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "account_invitations" })
export class AccountInvitation {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "token", type: "varchar", length: 128, unique: true })
  token!: string;

  @Column({ name: "email", type: "varchar", length: 255 })
  email!: string;

  @Column({ name: "invited_by", type: "char", length: 36, nullable: true })
  invitedBy!: string | null;

  @Column({ name: "group_id", type: "char", length: 36, nullable: true })
  groupId!: string | null;

  @Column({ name: "group_ids", type: "text", nullable: true })
  groupIds!: string | null;

  // JSON arrays of virtual_users.id / virtual_aliases.id to assign to the new
  // account on acceptance (only those still unassigned at that point). No
  // password is touched -- pure ownership assignment.
  @Column({ name: "recipient_ids", type: "text", nullable: true })
  recipientIds!: string | null;

  @Column({ name: "alias_ids", type: "text", nullable: true })
  aliasIds!: string | null;

  @Column({ name: "owner_domain_id", type: "int", nullable: true })
  ownerDomainId!: number | null;

  @Column({ name: "accepted_at", type: "datetime", nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: "expires_at", type: "datetime" })
  expiresAt!: Date;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
