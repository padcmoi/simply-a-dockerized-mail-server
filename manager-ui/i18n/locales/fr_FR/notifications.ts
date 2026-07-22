import type { Locales } from "../../Locales";

export default {
  title: "Notifications",
  empty: "Aucune notification pour l'instant.",
  markAllRead: "Tout marquer comme lu",
  someone: "Quelqu'un",
  saved: "Préférences de notification mises à jour.",
  pageHint: "Choisissez ce qui déclenche une notification",
  pageDescription:
    "Choisissez par quel canal chaque source vous joint. Décochez les deux et cette source cesse totalement de vous notifier, dans l'application comme par email.",
  channel: { inApp: "Notification", email: "Email" },
  source: { support: "Support" },
  sourceHint: {
    support: "Nouveaux tickets, réponses, prises en charge et changements de statut, sur les domaines auxquels vous avez accès.",
  },
  event: {
    "ticket-created": '{actor} a ouvert le ticket "{subject}" sur {domain}',
    "ticket-replied": '{actor} a répondu au ticket "{subject}"',
    "ticket-taken": '{actor} a pris en charge le ticket "{subject}"',
    "ticket-status": 'Le ticket "{subject}" est maintenant {status}',
  },
} satisfies Locales["notifications"];
