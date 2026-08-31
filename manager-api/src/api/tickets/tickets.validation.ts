import { z } from "zod";
import { paginationQuerySchema } from "../../core/common/pagination.validation";

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_VISIBILITIES = ["public", "private"] as const;

// `mine` narrows the list to what the caller took in charge, `hideClosed` drops
// the tickets nobody is going to answer again. Both ride as strings on the
// query, so they are read explicitly rather than coerced: any other value than
// "true" means the full list.
export const ticketListQuerySchema = paginationQuerySchema.extend({
  mine: z.enum(["true", "false"]).optional(),
  hideClosed: z.enum(["true", "false"]).optional(),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

// The mailboxes and aliases the ticket is about, as ids of the chosen domain.
// Empty is a valid payload here and refused by the service instead, since
// whether naming one is mandatory is a server setting, not a shape.
export const createTicketSchema = z
  .object({
    domainId: z.coerce.number().int().positive(),
    subject: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(10_000),
    visibility: z.enum(TICKET_VISIBILITIES).optional(),
    recipientIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
    aliasIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  })
  .strict();

export const replyTicketSchema = z
  .object({
    body: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const editMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const updateStatusSchema = z
  .object({
    status: z.enum(TICKET_STATUSES),
  })
  .strict();

export type CreateTicketDto = z.infer<typeof createTicketSchema>;
export type ReplyTicketDto = z.infer<typeof replyTicketSchema>;
export type EditMessageDto = z.infer<typeof editMessageSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
