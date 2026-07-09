import type { Locales } from "../../Locales";

export default {
  alertTitle: "Adresses de boîtes (local-part plus domaine, destinations livrées par postfix).",
  alertDescription: "Les mots de passe sont hachés en SHA512-CRYPT avant stockage.",
  backToList: "Retour aux destinataires",
  chart: {
    title: "Répartition du quota du domaine",
    pending: "Ce destinataire",
  },
  form: {
    title: "Ajouter un destinataire",
    domain: "Domaine",
    domainPlaceholder: "Choisir un domaine",
    localPart: "Local part",
    localPartInvalid: "Lettres, chiffres et . _ + - uniquement",
    password: "Mot de passe",
    passwordMin: "Minimum {value} caractères",
    quotaMb: "Quota (Mo)",
    quotaMin: "Minimum {value} Mo",
    quotaMax: "Maximum {value} Mo restant sur le domaine",
    quotaRange: "{min}–{max} Mo",
    submit: "Créer",
  },
  table: {
    address: "Adresse",
    domain: "Domaine",
    quota: "Quota",
    used: "Consommé",
    active: "Actif",
  },
  toast: {
    pickDomain: "Choisissez d'abord un domaine",
    created: "Destinataire créé",
    createFailed: "Échec de la création",
    quotaTooLow: "Le quota doit être d'au moins {value} Mo",
  },
  postmaster: {
    badge: "Système",
    locked: "La boîte postmaster est gérée automatiquement et ne peut être ni modifiée, ni activée, ni supprimée",
  },
  editModal: {
    button: "Modifier",
    title: "Modifier {email}",
    saved: "Destinataire mis à jour",
    saveFailed: "Échec de la mise à jour",
  },
} satisfies Locales["recipients"];
