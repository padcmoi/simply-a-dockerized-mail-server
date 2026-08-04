import type { Locales } from "../../Locales";

export default {
  alertTitle: "Mail domains served by postfix.",
  alertDescription: "Creating one provisions the inactive postmaster and the DKIM key.",
  listLocked: "You don't have permission to view the domain list.",
  backToList: "Back to domains",
  chart: {
    title: "Mail volume allocation",
    pending: "This domain",
  },
  capacity: {
    title: "Mail volume capacity",
    hint: "Every domain reserves at least 10 MB, no unlimited quota",
    total: "Total",
    free: "Free on disk",
    reserved: "Reserved by domains",
    assignable: "Still assignable",
    allocatable: "Total allocatable",
    occupancy: "Occupancy (reserved / total)",
  },
  form: {
    title: "Add a domain",
    fqdn: "FQDN",
    fqdnInvalid: "Must be a valid FQDN",
    quotaMb: "Quota (MB)",
    quotaMax: "Max {value} MB",
    quotaMin: "Minimum {value} MB",
    quotaRange: "{min}–{max} MB",
    active: "Active",
    submit: "Add",
  },
  table: {
    id: "ID",
    domain: "Domain",
    active: "Active",
    quotaMb: "Quota (MB)",
  },
  toast: {
    added: "Domain added",
    addFailed: "Add failed",
    loadFailed: "Failed",
    quotaTooHigh: "Quota exceeds available capacity",
    quotaTooLow: "Quota must be at least {value} MB",
  },
  adminModal: {
    button: "Administer",
    title: "Domain administration",
    fqdnLocked: "A domain name cannot be changed: every mailbox address and every maildir on disk is built from it.",
    dangerZone: "Danger zone",
    delete: "Delete this domain",
    confirmDelete: "Delete this domain?",
    confirmDeleteDesc:
      "This permanently deletes {domain} and cascades to its recipients, aliases, quota rows and DKIM keys. " +
      "All the mail it stores is erased from disk.",
    saved: "Domain updated",
    saveFailed: "Failed to update domain",
    deleted: "Domain deleted",
    deleteFailed: "Failed to delete domain",
  },
} satisfies Locales["domains"];
