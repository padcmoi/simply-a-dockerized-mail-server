import type { Locales } from "../../Locales";

export default {
  title: "Preferences",
  subtitle: "Your account settings on this device.",
  language: "Language",
  appearance: "Appearance",
  themeColors: "Theme colours",
  themeColorsHint:
    "Saved against your account and applied again at every login, over the server colours. The two themes are held apart: what is picked here only touches the mode on screen, and a colour left alone keeps the server's.",
  themeColorsReset: "Reset",
  themeColorsLight: "You are editing the light theme.",
  themeColorsDark: "You are editing the dark theme.",
  themeEditLight: "Edit the light theme",
  themeEditDark: "Edit the dark theme",
  themeSaved: "Theme saved",
  themeExport: "Export",
  themeImportLabel: "Import",
  themeImport: {
    done: "Theme imported, still to be saved",
    json: "This file is not JSON",
    shape: "This JSON is not shaped like a theme: it needs an object with light or dark",
    token: "This file names a colour this interface does not paint",
    colour: "This file holds a value that is not a hex colour",
  },
  pageSize: "Default items per page",
  pageSizeHint: "Default number of rows shown in tables.",
} satisfies Locales["preferences"];
