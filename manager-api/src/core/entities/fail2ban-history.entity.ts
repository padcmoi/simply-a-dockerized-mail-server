import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

const epoch = { from: (value: string | number | null) => (value === null ? value : Number(value)), to: (value: number) => value };

@Entity({ name: "fail2ban_history" })
export class Fail2banHistory {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Index("idx_fail2ban_history_at")
  @Column({ name: "at", type: "bigint", transformer: epoch })
  at!: number;

  @Column({ name: "jail", type: "varchar", length: 64 })
  jail!: string;

  @Column({ name: "banned", type: "double" })
  banned!: number;
}
