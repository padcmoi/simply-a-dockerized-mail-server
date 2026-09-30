import type { Locales } from "../../Locales";

export default {
  subtitle: "Server-wide mail queue overview.",
  settings: "Postfix settings",
  messagesTitle: "Queued messages",
  reasonDetails: "Deferral reason per recipient",
  purge: "Purge this message",
  purgeTitle: "Purge message {id}?",
  purgeDescription:
    "The message is deleted for good from the Postfix queue, for all its recipients, with no notice to its sender.",
  purged: "Message {id} purged",
  purgeFailed: "Purge failed",
  purgeSelection: "Purge the selection ({count})",
  purgeManyTitle: "Purge {count} messages?",
  purgeManyDescription:
    "The messages are deleted for good from the Postfix queue, for all their recipients, with no notice to their senders.",
  purgedMany: "{count} messages purged",
  purgeFailedMany: "{count} message(s) not purged",
  empty: "No message in this queue.",
  truncated: "The {limit} most recent messages out of {total}.",
  nullSender: "<> (server notification)",
  col: {
    arrival: "Arrival",
    sender: "Sender",
    recipients: "Recipients",
    reason: "Deferral reason",
    size: "Size",
    id: "Queue ID",
  },
} satisfies Locales["postfixPage"];
