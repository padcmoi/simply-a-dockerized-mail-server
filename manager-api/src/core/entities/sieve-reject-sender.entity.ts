import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Unique("uq_sieve_reject_senders_sender", ["sender"])
@Entity({ name: "sieve_reject_senders" })
export class SieveRejectSender {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "sender", type: "varchar", length: 255 })
  sender!: string;

  @Column({ name: "enabled", type: "int", default: 1 })
  enabled!: number;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}
