import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// One row per ten seconds of the host's own figures, kept for a month. `at` is
// epoch milliseconds rather than a datetime because every read of this table
// groups it into buckets (an hour into minutes, a week into two-hour steps),
// and integer division is a bucket where a date needs parsing on both sides.
//
// The mariadb driver hands BIGINT back as a string, hence the transformer: the
// rest of the code only ever sees a number.
const epoch = { from: (value: string | number | null) => (value === null ? value : Number(value)), to: (value: number) => value };

@Entity({ name: "metrics_history" })
export class MetricsHistory {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Index("idx_metrics_history_at")
  @Column({ name: "at", type: "bigint", transformer: epoch })
  at!: number;

  @Column({ name: "cpu", type: "double", nullable: true })
  cpu!: number | null;

  @Column({ name: "load_1", type: "double" })
  load1!: number;

  @Column({ name: "load_5", type: "double" })
  load5!: number;

  @Column({ name: "load_15", type: "double" })
  load15!: number;

  @Column({ name: "memory_used", type: "double" })
  memoryUsed!: number;

  @Column({ name: "memory_total", type: "double" })
  memoryTotal!: number;

  @Column({ name: "net_in", type: "double", nullable: true })
  netIn!: number | null;

  @Column({ name: "net_out", type: "double", nullable: true })
  netOut!: number | null;

  // The two mail services, read by the same loop: messages rspamd handled
  // over the row's ten seconds, by verdict, plus what its filter learned, and
  // the mean depth of each Postfix queue. Null where the service was out of
  // reach for the whole row.
  @Column({ name: "rspamd_scanned", type: "double", nullable: true })
  rspamdScanned!: number | null;

  @Column({ name: "rspamd_no_action", type: "double", nullable: true })
  rspamdNoAction!: number | null;

  @Column({ name: "rspamd_greylist", type: "double", nullable: true })
  rspamdGreylist!: number | null;

  @Column({ name: "rspamd_add_header", type: "double", nullable: true })
  rspamdAddHeader!: number | null;

  @Column({ name: "rspamd_reject", type: "double", nullable: true })
  rspamdReject!: number | null;

  @Column({ name: "rspamd_learned", type: "double", nullable: true })
  rspamdLearned!: number | null;

  @Column({ name: "postfix_active", type: "double", nullable: true })
  postfixActive!: number | null;

  @Column({ name: "postfix_deferred", type: "double", nullable: true })
  postfixDeferred!: number | null;

  @Column({ name: "postfix_hold", type: "double", nullable: true })
  postfixHold!: number | null;

  @Column({ name: "postfix_incoming", type: "double", nullable: true })
  postfixIncoming!: number | null;
}
