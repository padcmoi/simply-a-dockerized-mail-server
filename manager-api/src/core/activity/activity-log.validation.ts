import { z } from "zod";
import { paginationQuerySchema } from "../common/pagination.validation";

// The two filters a journal takes on top of the shared paging: one action,
// and, on the server page only, one account. An unknown action is refused
// rather than matched to nothing, so a stale link says so.
export const activityListQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().min(1).max(64).optional(),
  actorId: z.string().trim().length(36).optional(),
});

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
