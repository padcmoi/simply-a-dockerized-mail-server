import { z } from "zod";

export const updateTicketsConfigSchema = z.object({
  ticketResourcesRequired: z.boolean(),
});

export type UpdateTicketsConfigDto = z.infer<typeof updateTicketsConfigSchema>;
