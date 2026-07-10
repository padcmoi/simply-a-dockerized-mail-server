import { z } from "zod";

// FQDNs are case-insensitive by spec but postfix/dovecot's virtual_domains
// lookups are plain string matches -- "Naskot.com" and "naskot.com" would
// silently become two different mail domains, so every domain name is
// normalized to lowercase before it ever reaches the database.
const fqdn = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "must be a FQDN")
  .transform((v) => v.toLowerCase());

// A domain must always reserve real disk space -- no such thing as an
// "unlimited" mail domain here (see MIN_DOMAIN_QUOTA_BYTES usage below).
export const MIN_DOMAIN_QUOTA_BYTES = 10 * 1024 * 1024; // 10 MB

// `ownerId` is intentionally not settable through create/update: the creating
// account always becomes the owner (see DomainsController.create), and
// transferring ownership afterwards goes exclusively through the dedicated
// PATCH /:domainId/owner endpoint (root-or-current-owner, audited).
export const createDomainSchema = z.object({
  domain: fqdn,
  quota: z.number().int().min(MIN_DOMAIN_QUOTA_BYTES, `Domain quota must be at least ${MIN_DOMAIN_QUOTA_BYTES} bytes (10 MB)`),
  active: z.boolean().optional(),
  userEndDate: z.string().date().nullable().optional(),
});

// `domain` is deliberately omitted, and no rename route exists anywhere: a
// domain's FQDN is its identity. `virtual_users.email`, `virtual_users.maildir`
// and the maildir tree on disk (/var/mail/vhosts/<domain>/) all embed it, and
// none of them follow the ON UPDATE CASCADE that would rewrite the row -- a
// rename would silently strand every mailbox of the domain.
export const updateDomainSchema = createDomainSchema.omit({ domain: true }).partial();

export const transferDomainOwnerSchema = z.object({
  newOwnerId: z.string().uuid(),
});

// Dedicated route + schema for just this one field, gated by the "admin"
// domain resource (see DomainsController.setActive) rather than the general
// "domain" modify used by PATCH /:domainId -- activating/deactivating mail
// acceptance for a domain is an Administration-page action, not a routine edit.
//
// `.strict()` here and on resizeDomainQuotaSchema: without it zod strips
// unknown keys, so a body carrying `domain` would get a 200 for a rename that
// never happened. The refusal has to be audible.
export const setDomainActiveSchema = z
  .object({
    active: z.boolean(),
  })
  .strict();

// Dedicated route + schema, one field, mirroring setDomainActiveSchema above
// -- see AdminDomainsController (resizeQuota). There is no rename sibling.
export const resizeDomainQuotaSchema = z
  .object({
    quota: z.number().int().min(MIN_DOMAIN_QUOTA_BYTES, `Domain quota must be at least ${MIN_DOMAIN_QUOTA_BYTES} bytes (10 MB)`),
  })
  .strict();

export type CreateDomainDto = z.infer<typeof createDomainSchema>;
export type UpdateDomainDto = z.infer<typeof updateDomainSchema>;
export type TransferDomainOwnerDto = z.infer<typeof transferDomainOwnerSchema>;
export type SetDomainActiveDto = z.infer<typeof setDomainActiveSchema>;
export type ResizeDomainQuotaDto = z.infer<typeof resizeDomainQuotaSchema>;
