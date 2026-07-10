import type { Locales } from "../../Locales";

export default {
  alertTitle: "Domaines mail servis par postfix.",
  alertDescription: "Toute création provisionne le postmaster inactif et la clé DKIM.",
  listLocked: "Vous n'avez pas la permission de voir la liste des domaines.",
  backToList: "Retour aux domaines",
  chart: {
    title: "Répartition du volume mail",
    pending: "Ce domaine",
  },
  capacity: {
    title: "Capacité du volume mail",
    hint: "Chaque domaine réserve au minimum 10 Mo, aucun quota illimité",
    total: "Total",
    free: "Libre sur disque",
    reserved: "Réservé par les domaines",
    assignable: "Encore assignable",
    allocatable: "Total attribuable",
    occupancy: "Occupation (réservé / total)",
  },
  form: {
    title: "Ajouter un domaine",
    fqdn: "FQDN",
    fqdnInvalid: "Doit être un FQDN valide",
    quotaMb: "Quota (Mo)",
    quotaMax: "Max {value} Mo",
    quotaMin: "Minimum {value} Mo",
    quotaRange: "{min}–{max} Mo",
    active: "Actif",
    submit: "Ajouter",
  },
  table: {
    id: "ID",
    domain: "Domaine",
    active: "Actif",
    quotaMb: "Quota (Mo)",
  },
  toast: {
    added: "Domaine ajouté",
    addFailed: "Échec de l'ajout",
    loadFailed: "Échec",
    quotaTooHigh: "Le quota dépasse la capacité disponible",
    quotaTooLow: "Le quota doit être d'au moins {value} Mo",
  },
  adminModal: {
    button: "Administrer",
    title: "Administration du domaine",
    fqdnLocked:
      "Un nom de domaine ne peut pas être modifié : toutes les adresses et tous les maildirs sur disque en découlent.",
    dangerZone: "Zone dangereuse",
    delete: "Supprimer ce domaine",
    confirmDelete: "Supprimer ce domaine ?",
    confirmDeleteDesc:
      "Ceci supprime définitivement {domain} ainsi que ses destinataires, alias, quotas et clés DKIM. " +
      "Tout le courrier stocké est effacé du disque.",
    saved: "Domaine mis à jour",
    saveFailed: "Échec de la mise à jour du domaine",
    deleted: "Domaine supprimé",
    deleteFailed: "Échec de la suppression du domaine",
  },
} satisfies Locales["domains"];
