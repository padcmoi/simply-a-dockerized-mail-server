import type { Locales } from "../../Locales";

export default {
  alertTitle: "Transférer une adresse (ou un domaine entier) vers un ou plusieurs destinataires réels.",
  backToList: "Retour aux alias",
  form: {
    title: "Ajouter un alias",
    domain: "Domaine",
    domainPlaceholder: "Choisir un domaine",
    localPart: "Local part",
    localPartInvalid: "Lettres, chiffres et . _ + - uniquement, sans domaine",
    destination: "Destination",
    destinationPlaceholder: "reel.example.com",
    destinationInvalid: "Doit être une adresse e-mail valide",
    submit: "Ajouter",
  },
  table: {
    from: "De",
    to: "Vers",
    domain: "Domaine",
    owner: "Compte",
    validity: "Validité",
  },
  toast: {
    pickDomain: "Choisissez d'abord un domaine",
    created: "Alias créé",
    createFailed: "Échec de la création",
  },
  editPage: {
    button: "Modifier",
    title: "Modifier {source}",
    saved: "Alias mis à jour",
    saveFailed: "Échec de la mise à jour",
    loadFailed: "Impossible de charger cet alias",
    validitySaved: "Période de validité mise à jour",
    validityFailed: "Impossible de mettre à jour la période de validité",
  },
} satisfies Locales["aliases"];
