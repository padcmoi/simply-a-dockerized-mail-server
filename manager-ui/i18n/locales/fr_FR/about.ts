import type { Locales } from "../../Locales";

export default {
  title: "Version",
  subtitle: "La version du logiciel que ce serveur exécute.",
  onGithub: "Voir sur GitHub",
  unavailable: "Version inconnue",
  preRelease: "Pré-release",
  stable: "Stable",
  draft: "Brouillon",
  published: "Publiée le {date}",
  publishedAgo: "Publiée le {date} ({ago})",
  unpublished: "Non publiée",
  noNotes: "Cette release ne porte aucune note.",
  noRelease: "Aucune release publiée sur GitHub pour le tag {version}.",
  viewTag: "Voir le tag sur GitHub",
  loadFailed: "GitHub n'a pas répondu.",
  rateLimited: "La limite d'appels anonymes à l'API GitHub est atteinte pour votre adresse. Réessayez dans une heure.",
  retry: "Réessayer",
  changelog: "Changelog",
  changelogMissing: "Aucun fichier CHANGELOG.md dans le tag {version}.",
} satisfies Locales["about"];
