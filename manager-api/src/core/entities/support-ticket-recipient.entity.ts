import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { SupportTicket } from "./support-ticket.entity";
import { VirtualUser } from "./virtual-user.entity";

// Which mailboxes a ticket is about. A pivot with two real foreign keys rather
// than a list of ids in a column: a mailbox deleted afterwards takes its rows
// with it (CASCADE), so a ticket can never point at an address that no longer
// exists. The pair is the primary key, so naming the same mailbox twice is
// refused by the schema itself.
@Index("idx_support_ticket_recipients_recipient_id", ["recipientId"])
@Entity({ name: "support_ticket_recipients" })
export class SupportTicketRecipient {
  @PrimaryColumn({ name: "ticket_id", type: "int" })
  ticketId!: number;

  @PrimaryColumn({ name: "recipient_id", type: "int" })
  recipientId!: number;

  @ManyToOne(() => SupportTicket, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "ticket_id", foreignKeyConstraintName: "fk_support_ticket_recipients_ticket_id" })
  ticket!: SupportTicket;

  @ManyToOne(() => VirtualUser, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "recipient_id", foreignKeyConstraintName: "fk_support_ticket_recipients_recipient_id" })
  recipient!: VirtualUser;
}
