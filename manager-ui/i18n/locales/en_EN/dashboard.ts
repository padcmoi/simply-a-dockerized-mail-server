import type { Locales } from "../../Locales";

export default {
  subtitle: "Overview of every mail-stack resource served by manager-api.",
  stats: {
    domains: "Domains",
    recipients: "Recipients",
    aliases: "Aliases",
    blockedSenders: "Blocked senders",
    accounts: "Accounts",
    activeCount: "{count} active",
    enabledCount: "{count} enabled",
    forwarders: "forwarders configured",
  },
  disk: {
    title: "Mail disk usage",
    used: "Used",
    free: "Free",
    reserved: "Reserved",
  },
  chart: {
    recipientsPerDomain: "Recipients per domain",
    recipients: "recipients",
  },
  recent: {
    domains: "Recent domains",
    recipients: "Recent recipients",
    noDomains: "No domains yet",
    noDomainsHint: "Add your first domain to start receiving mail.",
    noRecipients: "No recipients yet",
    noRecipientsHint: "Create a mailbox once a domain is added.",
    addDomain: "Add a domain",
    addRecipient: "Add a recipient",
    quotaLabel: "Quota: {value}",
  },
} satisfies Locales["dashboard"];
