import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Account } from "./account.entity";
import { SupportTicket } from "./support-ticket.entity";

@Index("idx_support_ticket_messages_ticket_id", ["ticketId"])
@Entity({ name: "support_ticket_messages" })
export class SupportTicketMessage {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "ticket_id", type: "int" })
  ticketId!: number;

  @ManyToOne(() => SupportTicket, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "ticket_id" })
  ticket!: SupportTicket;

  @Column({ name: "author_id", type: "char", length: 36, nullable: true })
  authorId!: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", onUpdate: "CASCADE" })
  @JoinColumn({ name: "author_id" })
  author!: Account | null;

  @Column({ name: "body", type: "text" })
  body!: string;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  // Null until the author edits the message; set to the edit time on every edit.
  @Column({ name: "updated_at", type: "datetime", nullable: true })
  updatedAt!: Date | null;

  // How many times the author has edited it, 0 for an untouched message.
  @Column({ name: "edit_count", type: "int", unsigned: true, default: 0 })
  editCount!: number;
}
