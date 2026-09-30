import type { Locales } from "../../Locales";

export default {
  bulk: {
    assign: "Set the owner",
    title: "Owner of {count} item(s)",
    hint: "The account picked becomes the owner of every selected item, in place of the previous one.",
    assigned: "{count} item(s) assigned to {account}",
    detached: "{count} item(s) detached",
  },
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
