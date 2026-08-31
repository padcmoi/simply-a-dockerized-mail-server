import type { Locales } from "../../Locales";

export default {
  subtitle: "Statistiques serveur du filtre anti-spam et historique récent des scans.",
  uptime: "uptime {s}s",
  history: {
    title: "Historique des scans",
    noData: "Aucun historique. L'historique est persisté dans Redis et s'accumule dans le temps.",
  },
  col: {
    from: "De",
    to: "À",
    action: "Action",
    score: "Score",
    size: "Taille",
    time: "Heure",
  },
  bayes: {
    title: "Statistiques bayésiennes",
    noData: "Aucun statfile Bayes pour le moment.",
    symbol: "Symbole",
    type: "Type",
    learns: "Apprentissages",
    users: "Utilisateurs",
  },
  actions: {
    title: "Seuils des actions",
    hint: "Score à partir duquel chaque action se déclenche. Les seuils les plus bas sont atteints en premier : greylist, puis add header, puis rewrite subject, puis reject.",
    softReject: "Soft reject",
    greylist: "Greylist",
    addHeader: "Add header",
    rewriteSubject: "Rewrite subject",
    reject: "Reject",
    negativeError: "Les seuils ne peuvent pas être négatifs.",
    orderError: "Les seuils doivent être croissants : greylist < add header < rewrite subject < reject.",
    save: "Enregistrer",
    saved: "Seuils enregistrés",
    saveFailed: "Échec de l'enregistrement des seuils",
    readOnlyHint: "Permissions rspamd modify et delete requises pour modifier ces seuils.",
    reset: "Réinitialiser aux valeurs d'usine",
    confirmReset: "Réinitialiser les seuils aux valeurs d'usine ?",
    confirmResetDesc:
      "Ceci écrase les seuils actuels et restaure la config livrée avec le projet (reject 15, add header 5, greylist et rewrite subject désactivés).",
    resetDone: "Seuils réinitialisés aux valeurs d'usine",
    resetFailed: "Échec de la réinitialisation des seuils",
  },
} satisfies Locales["rspamdPage"];
