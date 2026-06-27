import { z } from "zod";

const fqdn = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "must be a FQDN");

export const createDomainSchema = z.object({
  domain: fqdn,
  quota: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  ownerId: z.number().int().positive().nullable().optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export const updateDomainSchema = createDomainSchema.partial();

export type CreateDomainDto = z.infer<typeof createDomainSchema>;
export type UpdateDomainDto = z.infer<typeof updateDomainSchema>;
