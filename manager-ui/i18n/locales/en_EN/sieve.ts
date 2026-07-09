import type { Locales } from "../../Locales";

export default {
  alertTitle: "SQL blacklist enforced by postfix at MAIL FROM time.",
  form: {
    title: "Block a sender",
    sender: "Sender",
    senderPlaceholder: "spamdomain.com or full address",
    submit: "Block",
  },
  table: {
    sender: "Sender",
    enabled: "Enabled",
    created: "Created",
    updated: "Updated",
  },
  toast: {
    blocked: "Sender blocked",
    failed: "Failed",
  },
} satisfies Locales["sieve"];
