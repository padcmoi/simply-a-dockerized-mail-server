import type { Locales } from "../../Locales";

export default {
  title: "Préférences",
  subtitle: "Réglages de votre compte sur cet appareil.",
  language: "Langue",
  appearance: "Apparence",
  themeColors: "Couleurs du thème",
  themeColorsHint:
    "Essai en direct, rien n'est enregistré : un rechargement de la page rétablit les couleurs configurées. Les deux thèmes sont tenus à part, ce qui est choisi ici ne touche que le mode affiché.",
  themeColorsReset: "Rétablir",
  themeColorsLight: "Vous modifiez le thème clair.",
  themeColorsDark: "Vous modifiez le thème sombre.",
  pageSize: "Éléments par page par défaut",
  pageSizeHint: "Nombre de lignes affichées par défaut dans les tableaux.",
} satisfies Locales["preferences"];
