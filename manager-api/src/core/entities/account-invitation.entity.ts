import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "account_invitations" })
export class AccountInvitation {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "token", type: "varchar", length: 128, unique: true })
  token!: string;

  // NULL = open registration token: the visitor chooses their own email at
  // acceptance. A non-null email pins the invitation to that identity.
  @Column({ name: "email", type: "varchar", length: 255, nullable: true })
  email!: string | null;

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

  // Delegation staged for acceptance: when delegation_domain_id is set, the new
  // account receives a domain_delegations row on this domain with these caps
  // (NULL max = unlimited; the quota is clamped at acceptance to what the
  // domain can still commit).
  @Column({ name: "delegation_domain_id", type: "int", nullable: true })
  delegationDomainId!: number | null;

  @Column({ name: "delegation_max_recipients", type: "int", nullable: true })
  delegationMaxRecipients!: number | null;

  @Column({ name: "delegation_max_aliases", type: "int", nullable: true })
  delegationMaxAliases!: number | null;

  @Column({ name: "delegation_quota_mb", type: "int", nullable: true })
  delegationQuotaMb!: number | null;

  // Free label for an open registration link so its issuer remembers who it
  // is meant for; shown instead of the generic open-link badge.
  @Column({ name: "note", type: "varchar", length: 30, nullable: true })
  note!: string | null;

  @Column({ name: "accepted_at", type: "datetime", nullable: true })
  acceptedAt!: Date | null;

  // NULL = never expires (delegation invitations and open links only); a
  // plain account invitation always carries a date.
  @Column({ name: "expires_at", type: "datetime", nullable: true })
  expiresAt!: Date | null;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
