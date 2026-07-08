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
  // Which column to sort by -- validity of a specific value depends on the
  // endpoint (see `resolveSortColumn` below), not enforceable generically
  // here.
  sortBy: z.string().trim().max(50).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

// Never pass `query.sortBy` straight through to an ORM `order`/raw SQL
// column (injection) -- each service owns a whitelist of its own real
// columns and falls back to its existing default when the request is
// absent or names something not on that list.
export function resolveSortColumn<T extends string>(requested: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(requested ?? "") ? (requested as T) : fallback;
}
