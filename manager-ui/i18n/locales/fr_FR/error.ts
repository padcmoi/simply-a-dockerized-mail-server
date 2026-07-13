import type { Locales } from "../../Locales";

export default {
  generic: {
    title: "Une erreur est survenue",
    description: "Une erreur inattendue s'est produite. Veuillez réessayer dans un instant.",
  },
  403: {
    title: "Accès refusé",
    description: "Vous n'avez pas la permission de voir cette page.",
  },
  404: {
    title: "Page introuvable",
    description: "La page que vous cherchez n'existe pas ou a été déplacée.",
  },
} satisfies Locales["error"];
