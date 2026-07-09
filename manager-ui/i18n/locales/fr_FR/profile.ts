import type { Locales } from "../../Locales";

export default {
  alertTitle: "Profil de votre compte",
  alertDescription:
    "Utilisé pour l'avatar de la barre latérale et les notifications futures. L'authentification continue d'utiliser votre identifiant.",
  identity: "Identité",
  displayName: "Nom affiché",
  displayNameHint: "Affiché dans la barre latérale à la place de l'identifiant.",
  email: "Email",
  emailHint: "Optionnel ; doit être unique entre les comptes.",
  avatarUrl: "URL de l'avatar",
  avatarUrlHint: "URL HTTPS publique d'une image carrée ; bascule sur les initiales si vide.",
  emailInvalid: "Email invalide",
  urlInvalid: "URL invalide",
  save: "Enregistrer",
  toast: {
    updated: "Profil mis à jour",
    updateFailed: "Échec de la mise à jour",
    loadFailed: "Échec du chargement du profil",
  },
  permissions: {
    title: "Permissions",
    root: "Root (accès total)",
    globalTitle: "Permissions globales",
    domainTitle: "Permissions par domaine",
    empty: "Aucune permission accordée",
    loadFailed: "Échec du chargement des permissions",
  },
} satisfies Locales["profile"];
