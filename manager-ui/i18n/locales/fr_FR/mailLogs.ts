import type { Locales } from "../../Locales";

export default {
  title: "Logs de Postfix et Dovecot",
  subtitle: "Les dernières lignes des journaux du serveur mail, les plus récentes en bas.",
  search: "Filtrer les lignes",
  older: "Charger les 500 lignes précédentes",
  beginning: "Début du journal",
  live: "En direct",
  download: "Télécharger le fichier en cours",
  downloadFailed: "Le téléchargement du journal a échoué",
  archives: "Archives ({n})",
  archivesNone: "Aucune archive",
  archiveItem: "Jusqu'au {at} · {size}",
  summary: "{n} lignes affichées sur {size}",
  updated: "écrit le {at}",
  empty: "Aucune ligne",
  loadFailed: "Le journal est illisible",
} satisfies Locales["mailLogs"];
