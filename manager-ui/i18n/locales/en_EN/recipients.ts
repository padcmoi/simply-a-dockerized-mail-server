import type { Locales } from "../../Locales";

export default {
  alertTitle: "Mailbox addresses (local-part plus domain destinations postfix delivers to).",
  alertDescription: "Passwords are hashed with SHA512-CRYPT before storage.",
  backToList: "Back to recipients",
  confirmDeleteDesc: "The mailbox and all the mail it stores are erased from disk. Its quota returns to the domain.",
  chart: {
    title: "Domain quota allocation",
    pending: "This recipient",
  },
  form: {
    title: "Add a recipient",
    domain: "Domain",
    domainPlaceholder: "Pick a domain",
    localPart: "Local part",
    localPartInvalid: "Letters, digits and . _ + - only",
    password: "Password",
    passwordMin: "Minimum {value} characters",
    quotaMb: "Quota (MB)",
    quotaMin: "Minimum {value} MB",
    quotaMax: "Maximum {value} MB left on the domain",
    quotaRange: "{min}–{max} MB",
    submit: "Create",
  },
  table: {
    address: "Address",
    domain: "Domain",
    quota: "Quota",
    used: "Used",
    active: "Active",
  },
  toast: {
    pickDomain: "Pick a domain first",
    created: "Recipient created",
    createFailed: "Create failed",
    quotaTooLow: "Quota must be at least {value} MB",
  },
  postmaster: {
    badge: "System",
    locked: "The postmaster mailbox is managed automatically and cannot be edited, activated or deleted",
  },
  editPage: {
    button: "Edit",
    title: "Edit {email}",
    saved: "Recipient updated",
    saveFailed: "Update failed",
    loadFailed: "Could not load this recipient",
  },
} satisfies Locales["recipients"];
