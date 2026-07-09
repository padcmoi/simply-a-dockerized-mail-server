import type { Locales } from "../../Locales";

export default {
  loading: "Vérification de l'invitation...",
  invalid: "Invitation invalide ou expirée.",
  title: "Créez votre compte",
  subtitle: "Vous avez été invité à gérer ce serveur mail.",
  emailLabel: "Email associé",
  groupLabel: "Groupe",
  noGroup: "Aucun groupe assigné pour le moment",
  usernameLabel: "Identifiant",
  usernameHint: "Lettres minuscules, chiffres, tirets et points. Minimum 3 caractères.",
  nameLabel: "Nom affiché (optionnel)",
  nameHint: "Affiché dans la barre latérale.",
  passwordLabel: "Mot de passe",
  submit: "Créer mon compte",
  success: "Compte créé",
  successHint: "Vous pouvez maintenant vous connecter avec vos identifiants.",
  goToLogin: "Se connecter",
  toast: {
    failed: "Échec de la création",
  },
} satisfies Locales["invite"];
