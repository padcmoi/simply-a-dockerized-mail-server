import { z } from "zod";

const fqdn = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "must be a FQDN");

// A domain must always reserve real disk space -- no such thing as an
// "unlimited" mail domain here (see MIN_DOMAIN_QUOTA_BYTES usage below).
export const MIN_DOMAIN_QUOTA_BYTES = 10 * 1024 * 1024; // 10 MB

export const createDomainSchema = z.object({
  domain: fqdn,
  quota: z.number().int().min(MIN_DOMAIN_QUOTA_BYTES, `Domain quota must be at least ${MIN_DOMAIN_QUOTA_BYTES} bytes (10 MB)`),
  active: z.boolean().optional(),
  ownerId: z.number().int().positive().nullable().optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export const updateDomainSchema = createDomainSchema.partial();

export type CreateDomainDto = z.infer<typeof createDomainSchema>;
export type UpdateDomainDto = z.infer<typeof updateDomainSchema>;
