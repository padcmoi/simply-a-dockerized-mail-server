import { useAuthStore } from "~/stores/auth";

// Tri-state language preference that mirrors the theme's light/dark/system
// model: "system" follows the browser, an explicit locale code pins the choice.
// Device-scoped via localStorage (like the theme quick-toggle and the default
// page size), so it is not tied to the authenticated account and works on the
// login screen too. `system` is the default, exactly like the color mode.
export const LOCALE_PREFERENCE_KEY = "locale_preference";

// The region half of some locale codes is not a real country ("en_EN" -> "EN"),
// so map each configured locale to the flag we actually want to display.
const LOCALE_FLAG_CODE: Record<string, string> = {
  en_EN: "GB",
  fr_FR: "FR",
};

export interface LocaleOption {
  value: string;
  // Flag emoji. For "system" it is the flag of the browser-detected locale, so
  // the option shows what it currently resolves to (like the trigger button).
  flag: string;
  // Display name for a concrete locale; null for "system" (caller localizes it).
  name: string | null;
}

export function useLocalePreference() {
  // The global i18n instance off nuxtApp, NOT useI18n(): this composable is also
  // called from the locale-preference plugin (to apply the saved choice on
  // mount), and useI18n() throws "Must be called at the top of a setup function"
  // outside a component setup. nuxtApp.$i18n works in a plugin and a component
  // alike, and it is the app-wide locale we want to read and switch anyway.
  const { locale, locales, setLocale } = useNuxtApp().$i18n;
  const { call } = useApi();
  const auth = useAuthStore();

  const preference = useLocalStorage<string>(LOCALE_PREFERENCE_KEY, "system");

  const availableCodes = computed(() => locales.value.map((l) => String(l.code)));

  function flagFor(code: string) {
    return countryFlagEmoji(LOCALE_FLAG_CODE[code] ?? code.slice(-2));
  }

  // Match the browser's ordered language list against the configured locales:
  // exact code first ("fr-FR" -> "fr_FR"), then language prefix ("fr" -> "fr_FR").
  // Server-side navigator is unavailable, so keep whatever locale is already
  // active there and let the client resolve on mount (see the plugin).
  function detectBrowserLocale() {
    if (!import.meta.client) return String(locale.value);
    const codes = availableCodes.value;
    const fallback = codes[0] ?? String(locale.value);
    const wanted = navigator.languages?.length ? [...navigator.languages] : [navigator.language];
    for (const tag of wanted) {
      const norm = tag.replace("-", "_").toLowerCase();
      const exact = codes.find((c) => c.toLowerCase() === norm);
      if (exact) return exact;
      const lang = norm.split("_")[0];
      const byLang = codes.find((c) => c.toLowerCase().split("_")[0] === lang);
      if (byLang) return byLang;
    }
    return fallback;
  }

  // The browser-detected locale, and the concrete locale the preference resolves
  // to ("system" -> browser match).
  const detected = computed(() => detectBrowserLocale());
  const resolved = computed(() => (preference.value === "system" ? detected.value : preference.value));

  // System first (the default) carrying the detected flag, then each locale.
  const options = computed<LocaleOption[]>(() => [
    { value: "system", flag: flagFor(detected.value), name: null },
    ...locales.value.map((l) => ({
      value: String(l.code),
      flag: flagFor(String(l.code)),
      name: l.name ?? String(l.code),
    })),
  ]);

  async function apply() {
    // `resolved` is a plain string; setLocale wants the generated locale-code
    // union. It only ever holds a configured code, so the cast is safe.
    if (locale.value !== resolved.value) await setLocale(resolved.value as typeof locale.value);
  }

  // Persist the concrete locale in use to the account profile
  // (`account_profiles.locale`), so it survives a device change. Best effort and
  // client + authenticated only: a failed save must never block the UI, and on
  // the login screen there is no account yet (the login page calls it once the
  // session exists).
  async function persist() {
    if (!import.meta.client || !auth.session) return;
    try {
      await call("/auth/jwt/me", { method: "PATCH", body: { locale: resolved.value } });
    } catch {
      // best effort
    }
  }

  async function setPreference(value: string) {
    preference.value = value;
    await apply();
    await persist();
  }

  return { preference, resolved, detected, options, availableCodes, flagFor, detectBrowserLocale, apply, setPreference, persist };
}
