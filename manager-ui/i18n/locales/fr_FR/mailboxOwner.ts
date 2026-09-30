import type { Locales } from "../../Locales";

export default {
  bulk: {
    assign: "Définir le propriétaire",
    title: "Propriétaire de {count} élément(s)",
    hint: "Le compte choisi devient le propriétaire de chaque élément sélectionné, à la place du précédent.",
    assigned: "{count} élément(s) attribué(s) à {account}",
    detached: "{count} élément(s) détaché(s)",
  },
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
