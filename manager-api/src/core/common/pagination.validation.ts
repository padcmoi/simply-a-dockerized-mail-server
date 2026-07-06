import { z } from "zod";

// `limit` is left optional (no default) on purpose: its absence is what
// signals "legacy full-list" behavior to every list service (see each
// service's `list()` — internal consumers like dashboards/pickers never
// send it, and keep getting the complete unpaginated array).
export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .refine((v) => [10, 25, 50].includes(v), { message: "limit must be 10, 25 or 50" })
    .optional(),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(200).optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
