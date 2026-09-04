import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Account } from "./account.entity";

// One line per thing an account did, or had done to it: the fact, the object,
// where from, when. Never the content: a reply is "replied to ticket X", a
// password change is "changed the password". `actor` is who did it, `subject`
// the account it concerns, the same one except when an administrator acts on
// someone else's account, which then shows in both journals.
@Index("idx_activity_log_actor", ["actorId", "createdAt"])
@Index("idx_activity_log_subject", ["subjectId", "createdAt"])
@Index("idx_activity_log_action", ["action"])
@Index("idx_activity_log_created", ["createdAt"])
@Entity({ name: "activity_log" })
export class ActivityLog {
  // A log only ever grows, and int tops out at two billion lines. bigint, which
  // the driver hands over as a string, so the id is one on both sides.
  @PrimaryGeneratedColumn({ name: "id", type: "bigint" })
  id!: string;

  @Column({ name: "actor_id", type: "char", length: 36, nullable: true })
  actorId!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "actor_id", foreignKeyConstraintName: "fk_activity_log_actor" })
  actor!: Account | null;

  @Column({ name: "subject_id", type: "char", length: 36, nullable: true })
  subjectId!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "RESTRICT" })
  @JoinColumn({ name: "subject_id", foreignKeyConstraintName: "fk_activity_log_subject" })
  subject!: Account | null;

  @Column({ name: "action", type: "varchar", length: 64 })
  action!: string;

  @Column({ name: "entity_type", type: "varchar", length: 32, nullable: true })
  entityType!: string | null;

  @Column({ name: "entity_id", type: "varchar", length: 64, nullable: true })
  entityId!: string | null;

  // What the object is called, as it was at the time: a mailbox address, a
  // ticket subject. Kept here because the object may be gone when the line is
  // read, and a bare id would then name nothing.
  @Column({ name: "entity_label", type: "varchar", length: 255, nullable: true })
  entityLabel!: string | null;

  @Column({ name: "details", type: "json", nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ name: "ip", type: "varchar", length: 45, nullable: true })
  ip!: string | null;

  @Column({ name: "user_agent", type: "varchar", length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
