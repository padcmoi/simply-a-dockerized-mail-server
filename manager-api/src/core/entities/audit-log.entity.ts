import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "audit_log" })
export class AuditLog {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "actor_id", type: "char", length: 36, nullable: true })
  actorId!: string | null;

  @Column({ name: "action", type: "varchar", length: 64 })
  action!: string;

  @Column({ name: "entity_type", type: "varchar", length: 32 })
  entityType!: string;

  @Column({ name: "entity_id", type: "varchar", length: 36, nullable: true })
  entityId!: string | null;

  @Column({ name: "before_json", type: "text", nullable: true })
  beforeJson!: string | null;

  @Column({ name: "after_json", type: "text", nullable: true })
  afterJson!: string | null;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
