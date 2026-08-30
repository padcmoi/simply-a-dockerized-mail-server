export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export function ticketStatusColor(status: string) {
  if (status === "open") return "info" as const;
  if (status === "in_progress") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "neutral" as const;
}
