import type { Locales } from "../../Locales";

export default {
  label: "Owner account",
  hint: "The account this mailbox belongs to. A mailbox belongs to at most one account.",
  unassigned: "No owner",
  pickAccount: "Select an account",
  attach: "Assign",
  detach: "Detach",
  assigned: "Owner assigned",
  detached: "Owner detached",
  failed: "The change failed",
} satisfies Locales["mailboxOwner"];
