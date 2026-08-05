import type { Locales } from "../../Locales";

export default {
  title: "Preferences",
  subtitle: "Your account settings on this device.",
  language: "Language",
  appearance: "Appearance",
  themeColors: "Theme colours",
  themeColorsHint:
    "A live try, nothing is saved: reloading the page brings the configured colours back. The two themes are held apart, so what is picked here only touches the mode on screen.",
  themeColorsReset: "Reset",
  themeColorsLight: "You are editing the light theme.",
  themeColorsDark: "You are editing the dark theme.",
  pageSize: "Default items per page",
  pageSizeHint: "Default number of rows shown in tables.",
} satisfies Locales["preferences"];
