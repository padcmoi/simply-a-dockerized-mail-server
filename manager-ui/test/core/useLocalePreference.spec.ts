import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useLocalePreference } from "~/composables/useLocalePreference";

vi.mock("~/stores/auth", () => ({ useAuthStore: () => ({ session: null }) }));

// Pure-logic coverage of the tri-state locale preference. The browser-detection
// branch of detectBrowserLocale() is client-only (`import.meta.client`), which is
// falsy under vitest, so here `detected` falls back to the active i18n locale --
// exactly the server path. The navigator matching itself is not exercised (this
// suite deliberately boots no Nuxt runtime); everything else is.
let locale: ReturnType<typeof ref<string>>;
let setLocale: ReturnType<typeof vi.fn>;

beforeEach(() => {
  locale = ref("en_GB");
  setLocale = vi.fn();
  // The composable reads i18n off nuxtApp.$i18n (so it works in the plugin too),
  // not useI18n(), so that is what the test provides.
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: {
      locale,
      locales: ref([
        { code: "en_GB", name: "English" },
        { code: "fr_FR", name: "Français" },
      ]),
      setLocale,
    },
  }));
  // Return the region code passed in, so flag mapping is assertable as a string.
  vi.stubGlobal("countryFlagEmoji", (c: string) => c);
  // Fresh ref per call, defaulting to the requested initial value ("system").
  vi.stubGlobal("useLocalStorage", (_k: string, init: unknown) => ref(init));
  vi.stubGlobal("useApi", () => ({ call: vi.fn() }));
});

describe("useLocalePreference", () => {
  it("defaults to the system preference, resolving to the active locale", () => {
    const { preference, detected, resolved } = useLocalePreference();
    expect(preference.value).toBe("system");
    expect(detected.value).toBe("en_GB");
    expect(resolved.value).toBe("en_GB");
  });

  it("maps each configured locale to its real country flag, else the last two chars", () => {
    const { flagFor } = useLocalePreference();
    expect(flagFor("en_GB")).toBe("GB");
    expect(flagFor("fr_FR")).toBe("FR");
    expect(flagFor("pt_BR")).toBe("BR");
  });

  it("lists system first (no name) then each locale with its name and flag", () => {
    const { options } = useLocalePreference();
    expect(options.value).toEqual([
      { value: "system", flag: "GB", name: null },
      { value: "en_GB", flag: "GB", name: "English" },
      { value: "fr_FR", flag: "FR", name: "Français" },
    ]);
  });

  it("resolves a concrete preference to that locale, not the detected one", () => {
    const p = useLocalePreference();
    p.preference.value = "fr_FR";
    expect(p.resolved.value).toBe("fr_FR");
  });

  it("falls back to the detected locale when the stored code is no longer configured", () => {
    const p = useLocalePreference();
    p.preference.value = "en_EN";
    expect(p.resolved.value).toBe("en_GB");
  });

  it("setPreference stores the choice and switches the active locale when it differs", async () => {
    const { preference, setPreference } = useLocalePreference();
    await setPreference("fr_FR");
    expect(preference.value).toBe("fr_FR");
    expect(setLocale).toHaveBeenCalledWith("fr_FR");
  });

  it("setPreference does not switch when the resolved locale is already active", async () => {
    const { setPreference } = useLocalePreference();
    await setPreference("en_GB");
    expect(setLocale).not.toHaveBeenCalled();
  });
});
