import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { SupportTicket } from "./support-ticket.entity";
import { VirtualAlias } from "./virtual-alias.entity";

// Which aliases a ticket is about. Its own table rather than one shared with
// the mailboxes: a single pivot carrying a "kind" column could not hold a real
// foreign key to two different tables, which is the whole point here.
@Index("idx_support_ticket_aliases_alias_id", ["aliasId"])
@Entity({ name: "support_ticket_aliases" })
export class SupportTicketAlias {
  @PrimaryColumn({ name: "ticket_id", type: "int" })
  ticketId!: number;

  @PrimaryColumn({ name: "alias_id", type: "int" })
  aliasId!: number;

  @ManyToOne(() => SupportTicket, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "ticket_id", foreignKeyConstraintName: "fk_support_ticket_aliases_ticket_id" })
  ticket!: SupportTicket;

  @ManyToOne(() => VirtualAlias, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "alias_id", foreignKeyConstraintName: "fk_support_ticket_aliases_alias_id" })
  alias!: VirtualAlias;
}
