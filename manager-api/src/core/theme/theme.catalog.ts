// What a theme is allowed to hold, owned here and served to the interface by
// `GET /config/theme` rather than copied into it: a colour the front could send
// and the API would refuse is a form that lies.
//
// The seven aliases every accent is derived from. One colour is stored per
// alias, not eleven: the steps are a ramp computed from it, and storing a
// computed value is storing a decision nobody made.
export const THEME_ALIASES = ["primary", "secondary", "success", "info", "warning", "error", "neutral"] as const;

// The surfaces painted on top of them. They are not all cut from `neutral`: in
// light the page background is a plain white, which is why it is a token of its
// own rather than a shade of something else.
export const THEME_SURFACES = [
  "--ui-bg",
  "--ui-bg-muted",
  "--ui-bg-elevated",
  "--ui-bg-accented",
  "--ui-bg-inverted",
  "--ui-border",
  "--ui-border-muted",
  "--ui-border-accented",
  "--ui-border-inverted",
  "--ui-text-dimmed",
  "--ui-text-muted",
  "--ui-text-toned",
  "--ui-text",
  "--ui-text-highlighted",
  "--ui-text-inverted",
] as const;

export const THEME_TOKENS = [...THEME_ALIASES, ...THEME_SURFACES] as const;

// Two themes, never one: an interface has a light face and a dark one, and a
// colour chosen for either says nothing about the other.
export const THEME_MODES = ["light", "dark"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export type ThemePalette = Record<string, string>;

export interface ThemeView {
  light: ThemePalette;
  dark: ThemePalette;
}

export function emptyTheme(): ThemeView {
  return { light: {}, dark: {} };
}
