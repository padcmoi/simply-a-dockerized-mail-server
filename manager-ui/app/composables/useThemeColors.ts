export function useThemeColors(scope: ThemeScope = "account") {
  const colorMode = useColorMode();
  const { call } = useApi();
  const toast = useToast();
  const { t } = useI18n();
  const { apiErrorMessage } = useApiError();

  const app = useState<ThemeView>("theme-app", emptyTheme);
  const account = useState<ThemeView>("theme-account", emptyTheme);
  const catalogue = useState<{ aliases: string[]; surfaces: string[] }>("theme-tokens", () => ({
    aliases: [...THEME_ALIASES],
    surfaces: [...THEME_SURFACES],
  }));

  // What each mode shows for each token with no theme applied at all, read from
  // the live document and kept as the starting point of every picker.
  const seeds = useState<Record<ThemeMode, ThemePalette>>("theme-seeds", () => ({ light: {}, dark: {} }));

  const saving = ref(false);

  // The theme as it is stored, held beside the one being edited. A pick is a
  // proposal until it is saved: leaving the bench without saving puts the
  // interface back where the database has it, instead of letting a colour nobody
  // kept go on painting every other page for the rest of the session.
  const stored = ref<ThemeView>(mergeThemes(scope === "app" ? app.value : account.value));
  const dirty = ref(false);

  const mode = computed<ThemeMode>(() => (colorMode.value === "dark" ? "dark" : "light"));
  const edited = computed(() => (scope === "app" ? app.value : account.value));
  const effective = computed(() => mergeThemes(app.value, account.value));
  const touched = computed(() => Object.keys(edited.value[mode.value]).length > 0);

  function styleElement() {
    const found = document.getElementById(THEME_STYLE_ID);
    if (found) return found as HTMLStyleElement;
    const style = document.createElement("style");
    style.id = THEME_STYLE_ID;
    document.head.append(style);
    return style;
  }

  function apply() {
    if (!import.meta.client) return;
    styleElement().textContent = themeCss(effective.value);
  }

  function write(view: ThemeView) {
    if (scope === "app") app.value = view;
    else account.value = view;
  }

  // What is on screen is now what is stored: everything read back from the API
  // and everything just written to it.
  function remember() {
    stored.value = mergeThemes(edited.value);
    dirty.value = false;
  }

  // Only the instance that changed something puts it back. The page around the
  // bench holds this composable too, merely to read the theme, and restoring
  // from it on unmount would undo what the bench had just saved.
  function discard() {
    if (!dirty.value) return;
    write(mergeThemes(stored.value));
    apply();
  }

  if (getCurrentScope()) onScopeDispose(discard);

  // Two steps, because neither alone is enough. A probe resolves `var()` chains
  // and colour mixes into a concrete colour, but the browser keeps it in the
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

  // Read with every theme muted, so a token reports what the interface ships
  // with rather than the colour someone just wrote into it. Both modes in one
  // pass, the dark class flipped and put back before anything is painted.
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
    const next: Record<ThemeMode, ThemePalette> = { light: {}, dark: {} };
    for (const each of THEME_MODES) {
      root.classList.toggle("dark", each === "dark");
      for (const alias of catalogue.value.aliases) next[each][alias] = readLive(probe, paint, `var(--ui-${alias})`);
      for (const token of catalogue.value.surfaces) next[each][token] = readLive(probe, paint, `var(${token})`);
    }
    root.classList.toggle("dark", wasDark);
    probe.remove();
    style.disabled = false;
    seeds.value = next;
  }

  // What this token would be painted with if this scope held nothing: the layer
  // underneath, which for an account is the server's theme and for the server is
  // what the interface ships with.
  function underneath(each: ThemeMode, token: string) {
    if (scope === "account") {
      const server = app.value[each][token];
      if (server) return server;
    }
    return seeds.value[each][token];
  }

  // What a token is actually painted with in that mode: this scope's own colour
  // if it has one, the layer underneath otherwise.
  function valueIn(each: ThemeMode, token: string) {
    return edited.value[each][token] ?? underneath(each, token) ?? "#000000";
  }

  function prune(view: ThemeView) {
    return pruneTheme(view, underneath);
  }

  function valueOf(token: string) {
    return valueIn(mode.value, token);
  }

  function isPicked(token: string) {
    return edited.value[mode.value][token] !== undefined;
  }

  function setValue(token: string, colour: string) {
    edited.value[mode.value][token] = colour;
    dirty.value = true;
    // Changing `neutral` would drag the page background along with it, since
    // Nuxt UI cuts it from `neutral-900` in dark while light keeps a plain
    // white. Writing the background down at that moment cuts it loose for good,
    // as data rather than as a rule applied later: what is stored is what is
    // painted, on this page and on the server's first render alike.
    if (token === "neutral" && edited.value[mode.value]["--ui-bg"] === undefined) {
      edited.value[mode.value]["--ui-bg"] = valueOf("--ui-bg");
    }
    apply();
  }

  // Only the mode on screen: the other one keeps what was chosen for it, which
  // is the point of holding two themes.
  function reset() {
    edited.value[mode.value] = {};
    dirty.value = true;
    apply();
  }

  const path = computed(() => (scope === "app" ? "/config/theme" : "/my-space/theme"));

  async function load() {
    const data = await call<StoredTheme>(path.value);
    if (data.tokens) catalogue.value = data.tokens;
    write({ light: data.light ?? {}, dark: data.dark ?? {} });
    remember();
    apply();
    refreshSeeds();
  }

  // Every token of both modes, chosen or not: a file holding only what somebody
  // touched would restore a theme that depends on whatever the interface shipped
  // with the day it is read back. A snapshot says what the interface looked like,
  // which is what an export is for. It is written as the API takes it, so the
  // file can be replayed as is.
  function exportFile() {
    if (!import.meta.client) return;
    const known = [...catalogue.value.aliases, ...catalogue.value.surfaces];
    const snapshot = emptyTheme();
    for (const each of THEME_MODES) for (const token of known) snapshot[each][token] = valueIn(each, token);
    const payload = JSON.stringify(snapshot, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `theme-${scope}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Read into the bench, not into the database: an import is a proposal like any
  // other pick, and it takes the same Save to become the theme.
  async function importFile(file: File) {
    const known = [...catalogue.value.aliases, ...catalogue.value.surfaces];
    const result = parseThemeFile(await file.text(), known);
    if (!result.ok) {
      toast.add({ title: t(`preferences.themeImport.${result.reason}`), color: "error" });
      return false;
    }
    // A file holds every token, on purpose. What is kept is what it changes:
    // importing an export of the current theme has to leave the bench exactly as
    // it was, not mark all forty-four colours as chosen.
    write(prune(result.theme));
    dirty.value = true;
    apply();
    toast.add({ title: t("preferences.themeImport.done"), color: "success" });
    return true;
  }

  async function save() {
    saving.value = true;
    try {
      const trimmed = prune(edited.value);
      write(trimmed);
      await call(path.value, { method: "PUT", body: { light: trimmed.light, dark: trimmed.dark } });
      // Kept as the theme to fall back to only once the API has taken it: a save
      // that failed leaves an unsaved bench, which is what it is.
      remember();
      toast.add({ title: t("preferences.themeSaved"), color: "success" });
    } catch (e) {
      toast.add({ title: apiErrorMessage(e), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return {
    aliases: computed(() => catalogue.value.aliases),
    surfaces: computed(() => catalogue.value.surfaces),
    steps: THEME_STEPS,
    mode,
    touched,
    saving,
    valueOf,
    isPicked,
    setValue,
    apply,
    refreshSeeds,
    reset,
    load,
    save,
    exportFile,
    importFile,
  };
}
