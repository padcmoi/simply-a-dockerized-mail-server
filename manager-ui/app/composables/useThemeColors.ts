export const THEME_COLOR_ALIASES = ["primary", "secondary", "success", "info", "warning", "error", "neutral"] as const;

export type ThemeColorAlias = (typeof THEME_COLOR_ALIASES)[number];

export const THEME_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// The surfaces, which are not accents and not always cut from `neutral`: in
// light the page background is plain white, so it can only be reached here.
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

export type ThemeMode = "light" | "dark";

// How far each step sits from the one that was picked: mixed towards white
// below 500, towards black above, in oklab so the lightness moves evenly
// instead of drifting channel by channel.
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

const STYLE_ID = "theme-colors-bench";

// The one token deliberately cut loose from its alias, see `apply`.
const PAGE_BACKGROUND = "--ui-bg";

export function stepVar(alias: ThemeColorAlias, step: number) {
  return `--ui-color-${alias}-${step}`;
}

function shadeOf(base: string, mix: number) {
  if (mix === 0) return base;
  return `color-mix(in oklab, ${base}, ${mix > 0 ? "white" : "black"} ${Math.abs(mix)}%)`;
}

// `:root.dark` is what the colour mode sets; the light half is written as "not
// dark" rather than `.light`, so it holds whether or not that class is present.
function selectorFor(mode: ThemeMode) {
  return mode === "dark" ? ":root.dark" : ":root:not(.dark)";
}

function everyToken() {
  return [...THEME_COLOR_ALIASES.flatMap((alias) => THEME_STEPS.map((step) => stepVar(alias, step))), ...THEME_SURFACES];
}

export function useThemeColors() {
  const colorMode = useColorMode();
  const overrides = useState<Record<ThemeMode, Record<string, string>>>("theme-colors", () => ({ light: {}, dark: {} }));

  // What each mode shows for each property, read from the live document and
  // kept as the starting point of every picker. Both modes are read, not only
  // the one on screen: the page background is pinned per mode below, and
  // pinning dark's background to light's value would be worse than not pinning.
  const seeds = useState<Record<ThemeMode, Record<string, string>>>("theme-colors-seeds", () => ({
    light: {},
    dark: {},
  }));

  const mode = computed<ThemeMode>(() => (colorMode.value === "dark" ? "dark" : "light"));
  const current = computed(() => overrides.value[mode.value]);
  const touched = computed(() => Object.keys(current.value).length > 0);

  function styleElement() {
    const found = document.getElementById(STYLE_ID);
    if (found) return found as HTMLStyleElement;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.append(style);
    return style;
  }

  // The rules are written outside every `@layer`, which is the only thing that
  // reliably outranks the layered theme Nuxt UI generates from app.config.
  //
  // The page background is written on every pass, picked or not: Nuxt UI cuts it
  // from `neutral-900` in dark, so moving that alias would drag the whole page
  // with it, while in light it is a plain white that never moves. Pinned to what
  // the mode started with, it answers to its own picker in both modes and to
  // nothing else.
  function apply() {
    if (!import.meta.client) return;
    const blocks = (["light", "dark"] as ThemeMode[]).map((each) => {
      const written = { ...overrides.value[each] };
      const background = written[PAGE_BACKGROUND] ?? seeds.value[each][PAGE_BACKGROUND];
      if (background) written[PAGE_BACKGROUND] = background;
      const declarations = Object.entries(written).map(([token, colour]) => `${token}:${colour};`);
      return declarations.length ? `${selectorFor(each)}{${declarations.join("")}}` : "";
    });
    styleElement().textContent = blocks.join("");
  }

  // Two steps, because neither alone is enough. A probe resolves `var()` chains
  // and colour-mixes into a concrete colour, but the browser keeps it in the
  // space it was written in: reading a green `oklch(0.72 0.22 149)` as three
  // numbers yields a deep blue. Painting that colour on a one-pixel canvas and
  // reading the pixel back is the conversion to sRGB, done by the engine.
  function readLive(probe: HTMLElement, paint: CanvasRenderingContext2D | null, value: string) {
    probe.style.color = value;
    const resolved = getComputedStyle(probe).color;
    if (!paint) return "#000000";
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = "#000000";
    paint.fillStyle = resolved;
    paint.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0] = paint.getImageData(0, 0, 1, 1).data;
    return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }

  // Read with the bench's own stylesheet muted, so a token reports the theme it
  // would have without us rather than the colour we just wrote into it. Both
  // modes are read in one pass, the dark class flipped and put back before
  // anything is painted, so the page never blinks.
  function refreshSeeds() {
    if (!import.meta.client) return;
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const style = styleElement();
    style.disabled = true;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden";
    document.body.append(probe);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const paint = canvas.getContext("2d", { willReadFrequently: true });
    const next: Record<ThemeMode, Record<string, string>> = { light: {}, dark: {} };
    for (const each of ["light", "dark"] as ThemeMode[]) {
      root.classList.toggle("dark", each === "dark");
      for (const token of everyToken()) next[each][token] = readLive(probe, paint, `var(${token})`);
    }
    root.classList.toggle("dark", wasDark);
    probe.remove();
    style.disabled = false;
    seeds.value = next;
  }

  function valueOf(token: string) {
    return current.value[token] ?? seeds.value[mode.value][token] ?? "#000000";
  }

  // Whether this mode holds a colour of its own for that property, which is what
  // a marked control has to say: picked here, not inherited from the theme.
  function isPicked(token: string) {
    return current.value[token] !== undefined;
  }

  function isAliasPicked(alias: ThemeColorAlias) {
    return THEME_STEPS.some((step) => isPicked(stepVar(alias, step)));
  }

  function setValue(token: string, colour: string) {
    current.value[token] = colour;
    apply();
  }

  // One colour for a whole alias: the eleven steps are rebuilt around it, which
  // is what the library expects to find and what app.config would have produced
  // from a Tailwind palette.
  function setAlias(alias: ThemeColorAlias, colour: string) {
    for (const step of THEME_STEPS) current.value[stepVar(alias, step)] = shadeOf(colour, RAMP[step] ?? 0);
    apply();
  }

  // Only the mode on screen: the other one keeps whatever was tried on it, which
  // is the point of holding two themes.
  function reset() {
    overrides.value[mode.value] = {};
    apply();
    refreshSeeds();
  }

  return {
    aliases: THEME_COLOR_ALIASES,
    steps: THEME_STEPS,
    surfaces: THEME_SURFACES,
    mode,
    touched,
    stepVar,
    valueOf,
    isPicked,
    isAliasPicked,
    setValue,
    setAlias,
    apply,
    refreshSeeds,
    reset,
  };
}
