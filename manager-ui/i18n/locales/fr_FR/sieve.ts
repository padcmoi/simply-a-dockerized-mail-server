import type { Locales } from "../../Locales";

export default {
  alertTitle: "Liste de blocage SQL appliquée par postfix au moment du MAIL FROM.",
  form: {
    title: "Bloquer un expéditeur",
    sender: "Expéditeur",
    senderPlaceholder: "domainespam.com ou adresse complète",
    submit: "Bloquer",
  },
  table: {
    sender: "Expéditeur",
    enabled: "Activé",
    created: "Créé le",
    updated: "Modifié le",
  },
  toast: {
    blocked: "Expéditeur bloqué",
    failed: "Échec",
  },
} satisfies Locales["sieve"];
