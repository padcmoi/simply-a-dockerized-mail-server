import { z } from "zod";

/** A day, under which a window a card offers would outlive its own data. */
export const MIN_RETENTION_MS = 86_400_000;
/** A year: past that the table is worth a partition, not a longer purge. */
export const MAX_RETENTION_MS = 365 * 86_400_000;

export const updateSupervisionRetentionSchema = z.object({
  supervisionRetentionMs: z.number().int().min(MIN_RETENTION_MS).max(MAX_RETENTION_MS),
});

export type UpdateSupervisionRetentionDto = z.infer<typeof updateSupervisionRetentionSchema>;
