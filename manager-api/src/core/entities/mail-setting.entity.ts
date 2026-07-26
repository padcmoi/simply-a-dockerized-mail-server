import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "mail_settings" })
export class MailSetting {
  @PrimaryColumn({ name: "provider", type: "varchar", length: 20 })
  provider!: string;

  @Column({ name: "host", type: "varchar", length: 255, nullable: true })
  host!: string | null;

  @Column({ name: "port", type: "int", nullable: true })
  port!: number | null;

  @Column({ name: "secure", type: "tinyint", width: 1, default: 0 })
  secure!: number;

  @Column({ name: "username", type: "varchar", length: 255, nullable: true })
  username!: string | null;

  @Column({ name: "password", type: "varchar", length: 255, nullable: true })
  password!: string | null;

  @Column({ name: "from_address", type: "varchar", length: 255, nullable: true })
  fromAddress!: string | null;

  @Column({ name: "selected", type: "tinyint", width: 1, nullable: true, unique: true })
  selected!: number | null;

  @Column({ name: "validated", type: "tinyint", width: 1, default: 0 })
  validated!: number;

  @Column({ name: "otp", type: "char", length: 6, nullable: true })
  otp!: string | null;

  @Column({
    name: "updated_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}
