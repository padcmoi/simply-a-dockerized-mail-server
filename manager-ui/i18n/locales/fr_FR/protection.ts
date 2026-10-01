import type { Locales } from "../../Locales";

export default {
  bulk: {
    protect: "Protéger ({count})",
    unprotect: "Retirer la protection ({count})",
    confirmTitle: "Protéger {count} élément(s) ?",
    protected: "{count} élément(s) protégé(s)",
    unprotected: "Protection retirée de {count} élément(s)",
  },
  protect: "Protéger",
  unprotect: "Retirer la protection",
  protected: "Protégé : ni modification, ni suppression, ni changement de propriétaire",
  confirmTitle: "Protéger {label} ?",
  confirmDescription:
    "Une fois protégé, cet élément ne peut plus être modifié, supprimé ni changer de propriétaire, par personne. Seul un compte root peut retirer la protection.",
  protectedToast: "{label} est protégé",
  unprotectedToast: "Protection retirée de {label}",
  failed: "La protection n'a pas pu être changée",
} satisfies Locales["protection"];
