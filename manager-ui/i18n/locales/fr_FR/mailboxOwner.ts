import type { Locales } from "../../Locales";

export default {
  label: "Compte propriétaire",
  hint: "Le compte auquel cette boîte appartient. Une boîte appartient à un seul compte au maximum.",
  unassigned: "Aucun propriétaire",
  pickAccount: "Sélectionner un compte",
  attach: "Assigner",
  detach: "Détacher",
  assigned: "Propriétaire assigné",
  detached: "Propriétaire détaché",
  failed: "La modification a échoué",
} satisfies Locales["mailboxOwner"];
