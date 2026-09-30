import type { Locales } from "../../Locales";

export default {
  subtitle: "Vue d'ensemble de la file d'attente mail du serveur.",
  settings: "Réglages Postfix",
  messagesTitle: "Messages en file",
  reasonDetails: "Raison du report par destinataire",
  purge: "Purger ce message",
  purgeTitle: "Purger le message {id} ?",
  purgeDescription:
    "Le message est supprimé définitivement de la file Postfix, pour tous ses destinataires, sans avis à son expéditeur.",
  purged: "Message {id} purgé",
  purgeFailed: "Échec de la purge",
  empty: "Aucun message dans cette file.",
  truncated: "Les {limit} messages les plus récents sur {total}.",
  nullSender: "<> (avis du serveur)",
  col: {
    arrival: "Arrivée",
    sender: "Expéditeur",
    recipients: "Destinataires",
    reason: "Raison du report",
    size: "Taille",
    id: "Identifiant",
  },
} satisfies Locales["postfixPage"];
