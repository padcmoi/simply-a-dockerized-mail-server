import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "account_domain_acl" })
export class AccountDomainAcl {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "account_id", type: "int" })
  accountId!: number;

  @Column({ name: "domain_id", type: "int" })
  domainId!: number;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
