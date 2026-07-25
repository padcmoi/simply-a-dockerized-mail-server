import { notificationHtml } from "./notification-layout.template";

// The support-ticket notification email, one sentence per event, plus a link
// back to the thread. `status` is only read by the fallback (a status change);
// it stays `unknown` because the dispatcher forwards the raw payload value.
export interface SupportNotificationInput {
  type: string;
  subject: string;
  domainName: string | null;
  actor: string | null;
  status?: unknown;
  ticketUrl: string;
}

export function supportNotificationEmail(input: SupportNotificationInput) {
  const on = input.domainName ? ` on ${input.domainName}` : "";
  const actor = input.actor ?? "Someone";

  let body: string;
  switch (input.type) {
    case "ticket-created":
      body = `${actor} opened the support ticket "${input.subject}"${on}.`;
      break;
    case "ticket-replied":
      body = `${actor} replied to the support ticket "${input.subject}"${on}.`;
      break;
    case "ticket-taken":
      body = `${actor} took charge of the support ticket "${input.subject}"${on}.`;
      break;
    default:
      body = `The support ticket "${input.subject}"${on} is now "${String(input.status)}".`;
  }

  const text = [body, "", `Ticket: ${input.ticketUrl}`].join("\n");
  return { subject: `[Support] ${input.subject}`, text, html: notificationHtml(text) };
}
