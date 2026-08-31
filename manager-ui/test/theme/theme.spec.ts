import { describe, it, expect } from "vitest";
import type { ThemeMode } from "~/utils/theme";
import { emptyTheme, mergeThemes, parseThemeFile, pruneTheme, themeCss, themeRamp, themeSelector, shadeOf } from "~/utils/theme";

describe("themeCss", () => {
  it("writes nothing at all for a theme nobody touched", () => {
    expect(themeCss(emptyTheme())).toBe("");
  });

  // An alias is stored once and painted eleven times: what is kept is the colour
  // someone chose, not the ten shades a formula derived from it.
  it("expands an alias into its eleven steps", () => {
    const css = themeCss({ light: { primary: "#00C950" }, dark: {} });
    expect(css).toContain("--ui-color-primary-500:#00C950;");
    expect(css).toContain("--ui-color-primary-50:color-mix(in oklab, #00C950, white 92%)");
    expect(css).toContain("--ui-color-primary-950:color-mix(in oklab, #00C950, black 72%)");
    expect(css.match(/--ui-color-primary-/g)).toHaveLength(11);
  });

  it("writes a surface as it stands, with no ramp", () => {
    const css = themeCss({ light: { "--ui-bg": "#FFFFFF" }, dark: {} });
    expect(css).toBe(":root:not(.dark){--ui-bg:#FFFFFF;}");
  });

  // The two themes never meet: a colour chosen in dark has to reach dark alone,
  // which is what the selector pair is for.
  it("keeps each mode behind its own selector", () => {
    const css = themeCss({ light: { "--ui-bg": "#FFFFFF" }, dark: { "--ui-bg": "#0F172B" } });
    expect(css).toBe(":root:not(.dark){--ui-bg:#FFFFFF;}:root.dark{--ui-bg:#0F172B;}");
  });

  it("writes the light half as not-dark, so it holds without a light class", () => {
    expect(themeSelector("light")).toBe(":root:not(.dark)");
    expect(themeSelector("dark")).toBe(":root.dark");
  });
});

describe("mergeThemes", () => {
  // An account's colours lie over the server's, mode by mode. Neither side is
  // complete: what neither holds is what the interface ships with.
  it("lets the later theme win, key by key and mode by mode", () => {
    const server = { light: { primary: "#111111", "--ui-bg": "#FFFFFF" }, dark: { primary: "#222222" } };
    const own = { light: { primary: "#333333" }, dark: {} };
    expect(mergeThemes(server, own)).toEqual({
      light: { primary: "#333333", "--ui-bg": "#FFFFFF" },
      dark: { primary: "#222222" },
    });
  });

  it("leaves the sources untouched", () => {
    const server = { light: { primary: "#111111" }, dark: {} };
    mergeThemes(server, { light: { primary: "#333333" }, dark: {} });
    expect(server.light.primary).toBe("#111111");
  });
});

describe("themeRamp", () => {
  it("gives the eleven shades a colour produces, the middle one untouched", () => {
    const ramp = themeRamp("#00C950");
    expect(ramp).toHaveLength(11);
    expect(ramp[5]).toBe("#00C950");
    expect(ramp[0]).toContain("white 92%");
    expect(ramp[10]).toContain("black 72%");
  });

  it("mixes towards white below the middle and towards black above it", () => {
    expect(shadeOf("#00C950", 25)).toBe("color-mix(in oklab, #00C950, white 25%)");
    expect(shadeOf("#00C950", -25)).toBe("color-mix(in oklab, #00C950, black 25%)");
    expect(shadeOf("#00C950", 0)).toBe("#00C950");
  });
});

describe("parseThemeFile", () => {
  const tokens = ["primary", "--ui-bg"];
  const file = (value: unknown) => JSON.stringify(value);

  it("reads a theme carrying both modes", () => {
    const result = parseThemeFile(file({ light: { primary: "#2B7FFF" }, dark: { "--ui-bg": "#0f172b" } }), tokens);
    expect(result).toEqual({ ok: true, theme: { light: { primary: "#2B7FFF" }, dark: { "--ui-bg": "#0F172B" } } });
  });

  it("takes a file holding a single mode, the other staying empty", () => {
    const result = parseThemeFile(file({ dark: { primary: "#000000" } }), tokens);
    expect(result).toEqual({ ok: true, theme: { light: {}, dark: { primary: "#000000" } } });
  });

  // Each way a file can be wrong is said apart: "invalid file" tells whoever
  // exported it nothing about what to fix.
  it.each([
    ["what is not json at all", "{oops", "json"],
    ["json of another kind entirely", file([1, 2, 3]), "shape"],
    ["an object carrying neither mode", file({ nope: {} }), "shape"],
    ["a mode that is not an object", file({ light: "#FFFFFF" }), "shape"],
    ["a token this interface does not paint", file({ light: { nonsense: "#FFFFFF" } }), "token"],
    ["a value that is not a colour", file({ light: { primary: "red" } }), "colour"],
    ["a colour carrying css", file({ light: { primary: "#fff;content:url(x)" } }), "colour"],
    ["a colour that is not a string", file({ light: { primary: 16711680 } }), "colour"],
  ])("refuses %s", (_case, raw, reason) => {
    expect(parseThemeFile(raw, tokens)).toEqual({ ok: false, reason });
  });

  // The catalogue comes from the API, so a file is judged against what the API
  // would accept rather than what this bundle happens to remember.
  it("judges tokens against the catalogue it is given", () => {
    expect(parseThemeFile(file({ light: { secondary: "#FFFFFF" } }), tokens)).toEqual({ ok: false, reason: "token" });
    expect(parseThemeFile(file({ light: { secondary: "#FFFFFF" } }), [...tokens, "secondary"])).toMatchObject({ ok: true });
  });
});

describe("pruneTheme", () => {
  const shipped: Record<string, string> = { primary: "#00C950", "--ui-bg": "#0F172B" };
  const server: Record<string, string> = { primary: "#2B7FFF" };

  // What the server compares against: the colours the interface ships with, and
  // nothing else.
  const asServer = (_mode: ThemeMode, token: string) => shipped[token];

  // What an account compares against: the server's theme first, the shipped
  // colour where the server chose nothing.
  const asAccount = (_mode: ThemeMode, token: string) => server[token] ?? shipped[token];

  it("drops what an imported file repeats from the shipped theme", () => {
    const file = { light: { primary: "#00C950", "--ui-bg": "#1F0F2B" }, dark: {} };
    expect(pruneTheme(file, asServer)).toEqual({ light: { "--ui-bg": "#1F0F2B" }, dark: {} });
  });

  it("reads a repeat whatever its case", () => {
    expect(pruneTheme({ light: { primary: "#00c950" }, dark: {} }, asServer)).toEqual(emptyTheme());
  });

  // An account holds what differs from what it actually sees, which is the
  // server's colour where there is one.
  it("compares an account against the server, and against the shipped colour where the server is silent", () => {
    const own = { light: { primary: "#2B7FFF", "--ui-bg": "#0F172B" }, dark: {} };
    expect(pruneTheme(own, asAccount)).toEqual(emptyTheme());
    expect(pruneTheme({ light: { primary: "#00C950" }, dark: {} }, asAccount)).toEqual({
      light: { primary: "#00C950" },
      dark: {},
    });
  });

  // The background is written down the moment `neutral` moves, precisely so it
  // stops following it. Dropping it for being equal to the shipped colour would
  // hand it back to the alias.
  it("keeps a background equal to the shipped one when the mode also sets neutral", () => {
    const view = { light: { neutral: "#E2E8F0", "--ui-bg": "#0F172B" }, dark: {} };
    expect(pruneTheme(view, asServer)).toEqual({ light: { neutral: "#E2E8F0", "--ui-bg": "#0F172B" }, dark: {} });
  });

  it("keeps a token the layer underneath knows nothing about", () => {
    expect(pruneTheme({ light: { warning: "#FDC700" }, dark: {} }, asServer)).toEqual({
      light: { warning: "#FDC700" },
      dark: {},
    });
  });

  it("trims each mode on its own", () => {
    const view = { light: { primary: "#00C950" }, dark: { primary: "#FF6467" } };
    expect(pruneTheme(view, asServer)).toEqual({ light: {}, dark: { primary: "#FF6467" } });
  });
});
