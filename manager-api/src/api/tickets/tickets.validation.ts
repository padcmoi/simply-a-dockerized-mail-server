import { z } from "zod";
import { paginationQuerySchema } from "../../core/common/pagination.validation";

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_VISIBILITIES = ["public", "private"] as const;

// `mine` narrows the list to what the caller took in charge. It rides as a
// string on the query, so it is read explicitly rather than coerced: any other
// value than "true" means the full list.
export const ticketListQuerySchema = paginationQuerySchema.extend({
  mine: z.enum(["true", "false"]).optional(),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

export const createTicketSchema = z
  .object({
    domainId: z.coerce.number().int().positive(),
    subject: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(10_000),
    visibility: z.enum(TICKET_VISIBILITIES).optional(),
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
