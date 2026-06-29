import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "sieve_reject_senders" })
export class SieveRejectSender {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "sender", type: "varchar", length: 255, unique: true })
  sender!: string;

  @Column({ name: "enabled", type: "int", default: 1 })
  enabled!: number;

  @Column({
    name: "date_creation",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  dateCreation!: Date;
}
