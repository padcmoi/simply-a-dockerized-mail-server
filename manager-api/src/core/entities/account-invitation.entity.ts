import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "account_invitations" })
export class AccountInvitation {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "token", type: "varchar", length: 128, unique: true })
  token!: string;

  @Column({ name: "email", type: "varchar", length: 255 })
  email!: string;

  @Column({ name: "invited_by", type: "int", nullable: true })
  invitedBy!: number | null;

  @Column({ name: "domain_ids", type: "json", nullable: true })
  domainIds!: number[] | null;

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
