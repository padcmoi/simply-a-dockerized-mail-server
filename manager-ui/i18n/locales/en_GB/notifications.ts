import type { Locales } from "../../Locales";

export default {
  title: "Notifications",
  empty: "No notification yet.",
  markAllRead: "Mark all read",
  someone: "Someone",
  saved: "Notification preferences updated.",
  pageHint: "Choose what you get notified about",
  pageDescription:
    "Pick how each source reaches you. Turn both channels off and that source stops notifying you entirely, in the app and by email.",
  channel: { inApp: "Notification", email: "Email" },
  source: { support: "Support" },
  sourceHint: {
    support: "New tickets, replies, assignments and status changes, on the domains you have access to.",
  },
  event: {
    "ticket-created": '{actor} opened the ticket "{subject}" on {domain}',
    "ticket-replied": '{actor} replied to the ticket "{subject}"',
    "ticket-taken": '{actor} took charge of the ticket "{subject}"',
    "ticket-status": 'The ticket "{subject}" is now {status}',
  },
} satisfies Locales["notifications"];
