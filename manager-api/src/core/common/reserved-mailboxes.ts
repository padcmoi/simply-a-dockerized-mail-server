export const DMARC_REPORTS_LOCAL_PART = "dmarc_reports";

export const RESERVED_LOCAL_PARTS = ["postmaster", DMARC_REPORTS_LOCAL_PART] as const;
export type ReservedLocalPart = (typeof RESERVED_LOCAL_PARTS)[number];

export function asReservedLocalPart(localPart: string): ReservedLocalPart | null {
  const lower = localPart.toLowerCase();
  return (RESERVED_LOCAL_PARTS as readonly string[]).includes(lower) ? (lower as ReservedLocalPart) : null;
}

export function reservedLocalPartOf(email: string, domain: string): ReservedLocalPart | null {
  const lower = email.toLowerCase();
  const suffix = `@${domain.toLowerCase()}`;
  if (!lower.endsWith(suffix)) return null;
  return asReservedLocalPart(lower.slice(0, -suffix.length));
}

export function dmarcReportsAddress(domain: string) {
  return `${DMARC_REPORTS_LOCAL_PART}@${domain.toLowerCase()}`;
}
