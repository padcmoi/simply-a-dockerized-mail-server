import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Account } from "./account.entity";
import { SupportTicket } from "./support-ticket.entity";

@Entity({ name: "support_ticket_reads" })
export class SupportTicketRead {
  @PrimaryColumn({ name: "ticket_id", type: "int" })
  ticketId!: number;

  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @ManyToOne(() => SupportTicket, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "ticket_id" })
  ticket!: SupportTicket;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @Column({ name: "last_read_message_id", type: "int", default: 0 })
  lastReadMessageId!: number;

  @Column({
    name: "read_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  readAt!: Date;
}
