import type { Locales } from "../../Locales";

export default {
  subtitle: "Vue d'ensemble de toutes les ressources servies par manager-api.",
  stats: {
    domains: "Domaines",
    recipients: "Destinataires",
    aliases: "Alias",
    blockedSenders: "Expéditeurs bloqués",
    accounts: "Comptes",
    activeCount: "{count} actifs",
    enabledCount: "{count} activés",
    forwarders: "redirections configurées",
  },
  disk: {
    title: "Espace disque mail",
    used: "Utilisé",
    free: "Libre",
    reserved: "Réservé",
  },
  chart: {
    recipientsPerDomain: "Destinataires par domaine",
    recipients: "destinataires",
  },
  recent: {
    domains: "Domaines récents",
    recipients: "Destinataires récents",
    noDomains: "Aucun domaine pour l'instant",
    noDomainsHint: "Ajoutez votre premier domaine pour commencer à recevoir des mails.",
    noRecipients: "Aucun destinataire pour l'instant",
    noRecipientsHint: "Créez une boîte aux lettres une fois un domaine ajouté.",
    addDomain: "Ajouter un domaine",
    addRecipient: "Ajouter un destinataire",
    quotaLabel: "Quota : {value}",
  },
} satisfies Locales["dashboard"];
