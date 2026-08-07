import type { Locales } from "../../Locales";

export default {
  title: "Préférences",
  subtitle: "Réglages de votre compte sur cet appareil.",
  language: "Langue",
  appearance: "Apparence",
  themeColors: "Couleurs du thème",
  themeColorsHint:
    "Enregistré sur votre compte et réappliqué à chaque connexion, par-dessus les couleurs du serveur. Les deux thèmes sont tenus à part : ce qui est choisi ici ne touche que le mode affiché, et une couleur laissée telle quelle garde celle du serveur.",
  themeColorsReset: "Rétablir",
  themeColorsResetConfirm: "Rétablir les couleurs ?",
  themeColorsResetDesc:
    "Les couleurs du mode affiché reviennent à celles du serveur. Rien n'est enregistré tant que vous n'avez pas cliqué sur Enregistrer.",
  themeColorsLight: "Vous modifiez le thème clair.",
  themeColorsDark: "Vous modifiez le thème sombre.",
  themeEditLight: "Modifier le thème clair",
  themeEditDark: "Modifier le thème sombre",
  themeSaved: "Thème enregistré",
  themeExport: "Exporter",
  themeImportLabel: "Importer",
  themeImport: {
    done: "Thème importé, il reste à enregistrer",
    json: "Ce fichier n'est pas du JSON",
    shape: "Ce JSON n'a pas la forme d'un thème : il faut un objet avec « light » ou « dark »",
    token: "Ce fichier nomme une couleur que cette interface ne peint pas",
    colour: "Ce fichier contient une valeur qui n'est pas une couleur hexadécimale",
  },
  pageSize: "Éléments par page par défaut",
  pageSizeHint: "Nombre de lignes affichées par défaut dans les tableaux.",
} satisfies Locales["preferences"];
