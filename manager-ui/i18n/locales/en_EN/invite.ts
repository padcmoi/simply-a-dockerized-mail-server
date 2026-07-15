import type { Locales } from "../../Locales";

export default {
  loading: "Checking invitation...",
  invalid: "Invitation not found or expired.",
  title: "Set up your account",
  subtitle: "You have been invited to manage this mail server.",
  emailLabel: "Associated email",
  groupLabel: "Group",
  noGroup: "No group assigned yet",
  usernameLabel: "Username",
  usernameHint: "Lowercase letters, digits, hyphens and dots. Minimum 3 characters.",
  nameLabel: "Display name (optional)",
  nameHint: "Shown in the sidebar.",
  passwordLabel: "Password",
  passwordMin: "At least 8 characters",
  submit: "Create my account",
  success: "Account created",
  successHint: "You can now sign in with your credentials.",
  goToLogin: "Sign in",
  toast: {
    failed: "Account creation failed",
  },
} satisfies Locales["invite"];
