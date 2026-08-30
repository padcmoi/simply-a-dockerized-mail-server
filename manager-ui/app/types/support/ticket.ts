// Support tickets, in the shapes the API answers with.

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
