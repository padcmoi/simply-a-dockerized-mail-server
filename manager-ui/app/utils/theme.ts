// What a theme holds and how it becomes CSS. Pure on purpose: the same function
// builds the stylesheet the server injects into the first page and the one the
// preferences bench rewrites live, so what is rendered before hydration and
// after it cannot drift apart.
//
// The catalogue is the API's (`GET /config/theme` carries it), repeated here for
// the one moment the API cannot answer: the login screen of a server whose
// database is away still has to be painted.
export const THEME_ALIASES = ["primary", "secondary", "success", "info", "warning", "error", "neutral"] as const;

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

export const THEME_MODES = ["light", "dark"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export type ThemePalette = Record<string, string>;

export interface ThemeView {
  light: ThemePalette;
  dark: ThemePalette;
}

export const THEME_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// How far each step sits from the colour that was picked: mixed towards white
// below 500, towards black above, in oklab so the lightness moves evenly instead
// of drifting channel by channel. One colour is stored, eleven are painted.
const RAMP: Record<number, number> = {
  50: 92,
  100: 84,
  200: 68,
  300: 48,
  400: 25,
  500: 0,
  600: -18,
  700: -34,
  800: -48,
  900: -60,
  950: -72,
};

export const THEME_STYLE_ID = "theme-colors";

// The eleven steps one colour produces, for showing what a pick will do. An
// estimate on display, the same expression the stylesheet carries.
export function themeRamp(colour: string) {
  return THEME_STEPS.map((step) => shadeOf(colour, RAMP[step] ?? 0));
}

export function emptyTheme() {
  return { light: {}, dark: {} } as ThemeView;
}

export function shadeOf(base: string, mix: number) {
  if (mix === 0) return base;
  return `color-mix(in oklab, ${base}, ${mix > 0 ? "white" : "black"} ${Math.abs(mix)}%)`;
}

// `:root.dark` is what the colour mode sets; the light half is written as "not
// dark" rather than `.light`, so it holds whether or not that class is present.
export function themeSelector(mode: ThemeMode) {
  return mode === "dark" ? ":root.dark" : ":root:not(.dark)";
}

// The account's own colours laid over the server's, mode by mode. Neither side
// is complete and neither has to be: a token nobody set is a token the interface
// paints with what it ships with.
export function mergeThemes(...themes: ThemeView[]) {
  return {
    light: Object.assign({}, ...themes.map((t) => t.light)) as ThemePalette,
    dark: Object.assign({}, ...themes.map((t) => t.dark)) as ThemePalette,
  };
}

export function isThemeAlias(token: string) {
  return !token.startsWith("--");
}

// An alias becomes its eleven steps, a surface is written as it stands. The
// rules carry no `@layer`, which is the only thing that reliably outranks the
// layered theme Nuxt UI generates from app.config.
export function themeCss(theme: ThemeView) {
  return THEME_MODES.map((mode) => {
    const declarations = Object.entries(theme[mode] ?? {}).flatMap(([token, colour]) =>
      isThemeAlias(token)
        ? THEME_STEPS.map((step) => `--ui-color-${token}-${step}:${shadeOf(colour, RAMP[step] ?? 0)};`)
        : [`${token}:${colour};`]
    );
    return declarations.length ? `${themeSelector(mode)}{${declarations.join("")}}` : "";
  }).join("");
}

export type ThemeImportFailure = "json" | "shape" | "token" | "colour";

export type ThemeImportResult = { ok: true; theme: ThemeView } | { ok: false; reason: ThemeImportFailure };

const THEME_HEX = /^#[0-9A-Fa-f]{6}$/;

// A file is not a theme until it has been read as one. Four things can be wrong
// and each is said apart, since "invalid file" tells whoever exported it
// nothing: it is not JSON, it is JSON of another shape, it names a colour this
// interface does not paint, or it holds something that is not a colour.
//
// The known tokens are passed in rather than read from the constants above: the
// API serves its own catalogue, and an import has to be judged against what the
// API would accept, not against what this bundle happens to remember.
export function parseThemeFile(raw: string, tokens: string[]) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "json" } as ThemeImportResult;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "shape" } as ThemeImportResult;

  const source = parsed as Record<string, unknown>;
  const theme = emptyTheme();
  for (const mode of THEME_MODES) {
    const palette = source[mode];
    if (palette === undefined) continue;
    if (!palette || typeof palette !== "object" || Array.isArray(palette))
      return { ok: false, reason: "shape" } as ThemeImportResult;
    for (const [token, colour] of Object.entries(palette as Record<string, unknown>)) {
      if (!tokens.includes(token)) return { ok: false, reason: "token" } as ThemeImportResult;
      if (typeof colour !== "string" || !THEME_HEX.test(colour)) return { ok: false, reason: "colour" } as ThemeImportResult;
      theme[mode][token] = colour.toUpperCase();
    }
  }

  // A file carrying neither mode is a file that would silently change nothing.
  if (source.light === undefined && source.dark === undefined) return { ok: false, reason: "shape" } as ThemeImportResult;

  return { ok: true, theme } as ThemeImportResult;
}

// Only what actually differs from the layer underneath is worth holding. That
// layer is what the token would be painted with if this theme held nothing: for
// an account, the server's theme, and what the interface ships with where the
// server chose nothing either; for the server, the shipped colour alone.
//
// A colour equal to the one already in force is not a decision, it is noise that
// would freeze today's default into tomorrow's theme, which is the whole reason
// nothing is seeded. The page background is the one exception, kept whenever
// `neutral` is set in the same mode, since its point is to stay put while the
// alias moves.
export function pruneTheme(view: ThemeView, below: (mode: ThemeMode, token: string) => string | undefined) {
  const trimmed = emptyTheme();
  for (const mode of THEME_MODES) {
    for (const [token, colour] of Object.entries(view[mode] ?? {})) {
      const under = below(mode, token);
      const pinned = token === "--ui-bg" && view[mode].neutral !== undefined;
      if (pinned || !under || under.toUpperCase() !== colour.toUpperCase()) trimmed[mode][token] = colour;
    }
  }
  return trimmed;
}
