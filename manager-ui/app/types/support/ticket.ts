// Support tickets, in the shapes the API answers with.

export interface TicketRecipientRef {
  id: number;
  email: string;
}

export interface TicketAliasRef {
  id: number;
  source: string;
  destination: string;
}

export interface TicketRow {
  id: number;
  createdBy: string | null;
  domainId: number;
  domainName: string | null;
  subject: string;
  status: string;
  visibility: string;
  assignedTo: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  creatorEmail: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  awaitingMyReply: boolean;
  recipients: TicketRecipientRef[];
  aliases: TicketAliasRef[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: number;
  authorId: string | null;
  authorEmail: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  updatedAt: string | null;
  editCount: number;
}

// What a domain still offers to name. `required` is the server setting, so the
// creation form gates its submit on the same rule POST /tickets enforces.
export interface TicketDomainResources {
  required: boolean;
  recipients: TicketRecipientRef[];
  aliases: TicketAliasRef[];
}

export interface TicketReader {
  accountId: string;
  name: string | null;
  avatarUrl: string | null;
  lastReadMessageId: number;
  readAt: string;
}

export interface TicketDetail extends TicketRow {
  assigneeAvatarUrl: string | null;
  messages: TicketMessage[];
  messagesTotal: number;
  readers: TicketReader[];
}
