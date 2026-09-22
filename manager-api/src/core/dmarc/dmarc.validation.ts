import { z } from "zod";
import { paginationQuerySchema } from "../common/pagination.validation";

export const DMARC_INCOMING_SORTABLE = ["periodBegin", "receivedAt", "orgName", "domain", "messages", "dmarcPass"] as const;
export const DMARC_INCOMING_SEARCHABLE = ["orgName", "domain", "reportId", "orgEmail"] as const;
export const DMARC_OUTGOING_SORTABLE = [
  "createdAt",
  "reporterDomain",
  "policyDomain",
  "recipient",
  "status",
  "messages",
] as const;
export const DMARC_OUTGOING_SEARCHABLE = ["reporterDomain", "policyDomain", "recipient", "reportId"] as const;
export const DMARC_INBOX_SORTABLE = ["scannedAt", "mailbox", "status"] as const;
export const DMARC_INBOX_SEARCHABLE = ["mailbox", "sender", "subject"] as const;

export const DMARC_OUTGOING_STATUSES = ["sent", "failed", "skipped"] as const;
export const DMARC_INBOX_STATUSES = ["imported", "duplicate", "not-a-report", "failed"] as const;

const domainFilter = z.string().trim().toLowerCase().min(1).max(255).optional();

export const dmarcIncomingQuerySchema = paginationQuerySchema.extend({ domain: domainFilter });
export type DmarcIncomingQuery = z.infer<typeof dmarcIncomingQuerySchema>;

export const dmarcOutgoingQuerySchema = paginationQuerySchema.extend({
  domain: domainFilter,
  status: z.enum(DMARC_OUTGOING_STATUSES).optional(),
});
export type DmarcOutgoingQuery = z.infer<typeof dmarcOutgoingQuerySchema>;

export const dmarcInboxQuerySchema = paginationQuerySchema.extend({
  domain: domainFilter,
  status: z.enum(DMARC_INBOX_STATUSES).optional(),
});
export type DmarcInboxQuery = z.infer<typeof dmarcInboxQuerySchema>;

export const dmarcSettingsSchema = z
  .object({
    sendingEnabled: z.boolean(),
    reportHour: z.number().int().min(0).max(23),
    inboxes: z.array(z.email().max(255)).max(10),
    retentionDays: z.number().int().min(7).max(3650),
    copyTo: z.email().max(255).nullable().optional(),
  })
  .strict();
export type DmarcSettingsDto = z.infer<typeof dmarcSettingsSchema>;

export const dmarcRunSchema = z.object({ day: z.iso.date().optional() }).strict();
export type DmarcRunDto = z.infer<typeof dmarcRunSchema>;
