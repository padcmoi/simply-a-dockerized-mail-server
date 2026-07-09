import type { Locales } from "../../Locales";

export default {
  alertTitle: "Your account profile",
  alertDescription: "Used for the sidebar avatar and future notifications. Authentication still uses your username.",
  identity: "Identity",
  displayName: "Display name",
  displayNameHint: "Shown in the sidebar instead of your username.",
  email: "Email",
  emailHint: "Optional; must be unique across accounts.",
  avatarUrl: "Avatar URL",
  avatarUrlHint: "Public HTTPS URL to a square image; falls back to initials if empty.",
  emailInvalid: "Invalid email",
  urlInvalid: "Must be a URL",
  save: "Save changes",
  toast: {
    updated: "Profile updated",
    updateFailed: "Update failed",
    loadFailed: "Failed to load profile",
  },
  permissions: {
    title: "Permissions",
    root: "Root (full access)",
    globalTitle: "Global permissions",
    domainTitle: "Domain permissions",
    empty: "No permissions granted",
    loadFailed: "Failed to load permissions",
  },
} satisfies Locales["profile"];
