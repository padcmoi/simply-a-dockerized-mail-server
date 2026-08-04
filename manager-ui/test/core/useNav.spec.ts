import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, reactive } from "vue";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

// useNav statically imports the domain store, whose module calls the bare
// `defineStore` auto-import at eval time -- stub it before the dynamic import.
vi.stubGlobal("defineStore", defineStore);
const { useNav } = await import("~/composables/useNav");
const { useDomainStore } = await import("~/stores/domain");

let setLocalePreference: ReturnType<typeof vi.fn>;
let colorMode: { value: string; preference: string };

beforeEach(() => {
  setActivePinia(createPinia());
  setLocalePreference = vi.fn();
  colorMode = reactive({ value: "dark", preference: "dark" });
  vi.stubGlobal("useI18n", () => ({
    t: (k: string) => k,
    locale: ref("en_GB"),
    locales: ref([
      { code: "en_GB", name: "English" },
      { code: "fr_FR", name: "Français" },
    ]),
    setLocale: vi.fn(),
  }));
  // The language sub-menu now goes through useLocalePreference (tri-state, with a
  // "system" entry), so stub it: preference "system", three flagged options.
  vi.stubGlobal("useLocalePreference", () => ({
    preference: ref("system"),
    resolved: ref("en_GB"),
    detected: ref("en_GB"),
    options: ref([
      { value: "system", flag: "🇬🇧", name: null },
      { value: "en_GB", flag: "🇬🇧", name: "English" },
      { value: "fr_FR", flag: "🇫🇷", name: "Français" },
    ]),
    availableCodes: ref(["en_GB", "fr_FR"]),
    flagFor: (c: string) => c,
    detectBrowserLocale: () => "en_GB",
    apply: vi.fn(),
    setPreference: setLocalePreference,
  }));
  vi.stubGlobal("useColorMode", () => colorMode);
  vi.stubGlobal("useRoute", () => ({ path: "/" }));
});

function asRoot() {
  useAuthStore().session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io", isRoot: true };
}
function asUser() {
  useAuthStore().session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io", isRoot: false };
}
const noop = async () => {};

describe("useNav global nav items", () => {
  it("lists every admin section for a root account (perms bypassed)", () => {
    asRoot();
    const { adminNavItems } = useNav(noop);
    expect(adminNavItems.value.map((i) => i.to)).toEqual([
      "/admin",
      "/admin/domains",
      "/admin/rspamd",
      "/admin/postfix",
      "/admin/sieve",
      "/admin/accounts",
      "/admin/groups",
      "/admin/tickets",
      "/admin/api-tokens",
      "/admin/config",
      "/admin/supervision",
    ]);
  });

  it("always exposes the personal space, whatever the permissions", () => {
    asUser();
    const { personalNavItems } = useNav(noop);
    expect(personalNavItems.value.map((i) => i.to)).toEqual(["/my-space"]);
  });

  it("shows no admin section for a permissionless non-root account", () => {
    asUser();
    const { adminNavItems } = useNav(noop);
    expect(adminNavItems.value).toEqual([]);
  });

  it("reveals exactly the admin sections the account holds `access` on", () => {
    asUser();
    usePermissionsStore().data = {
      global: [
        { resource: "accounts", action: "access" },
        { resource: "groups", action: "access" },
      ],
      domain: [],
    };
    const { adminNavItems } = useNav(noop);
    expect(adminNavItems.value.map((i) => i.to)).toEqual(["/admin/accounts", "/admin/groups"]);
  });

  // The machine is the last entry of the sidebar, under the configuration it
  // sits below, and it is gated like any other section: on `access` alone.
  it("reveals the machine section on supervision access, root or not", () => {
    asUser();
    usePermissionsStore().data = { global: [{ resource: "supervision", action: "access" }], domain: [] };
    const { adminNavItems } = useNav(noop);
    expect(adminNavItems.value.map((i) => i.to)).toEqual(["/admin/supervision"]);
  });

  it("marks the section active with a prefix-aware match on the route path", () => {
    asRoot();
    vi.stubGlobal("useRoute", () => ({ path: "/admin/domains/example.com" }));
    const { adminNavItems, personalNavItems } = useNav(noop);
    const byTo = Object.fromEntries([...adminNavItems.value, ...personalNavItems.value].map((i) => [i.to, i.active]));
    expect(byTo["/admin/domains"]).toBe(true);
    expect(byTo["/admin"]).toBe(false);
    expect(byTo["/my-space"]).toBe(false);
  });
});

describe("useNav domain nav items", () => {
  it("is empty when no domain is selected", () => {
    asRoot();
    const { domainNavItems } = useNav(noop);
    expect(domainNavItems.value).toEqual([]);
  });

  it("lists every domain section for root against the selected domain", () => {
    asRoot();
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    const { domainNavItems } = useNav(noop);
    expect(domainNavItems.value.map((i) => i.to)).toEqual([
      "/admin/domains/example.com",
      "/admin/domains/example.com/recipients",
      "/admin/domains/example.com/aliases",
      "/admin/domains/example.com/quotas",
      "/admin/domains/example.com/app",
      "/admin/domains/example.com/rspamd",
    ]);
  });

  it("filters domain sections by per-domain `access` for a non-root account", () => {
    asUser();
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    usePermissionsStore().data = {
      global: [],
      domain: [{ domainId: 1, domainName: "example.com", resource: "recipients", action: "access" }],
    };
    const { domainNavItems } = useNav(noop);
    expect(domainNavItems.value.map((i) => i.to)).toEqual(["/admin/domains/example.com/recipients"]);
  });

  it("highlights the domain home only on an exact path match", () => {
    asRoot();
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    vi.stubGlobal("useRoute", () => ({ path: "/admin/domains/example.com" }));
    const { domainNavItems } = useNav(noop);
    const home = domainNavItems.value.find((i) => i.to === "/admin/domains/example.com");
    const recipients = domainNavItems.value.find((i) => i.to === "/admin/domains/example.com/recipients");
    expect(home?.active).toBe(true);
    expect(recipients?.active).toBe(false);
  });
});

describe("useNav user menu", () => {
  it("wires the sign-out entry to the supplied callback", () => {
    asRoot();
    const onSignOut = vi.fn();
    const { userItems } = useNav(onSignOut);
    const signOut = userItems.value[2]![0] as { label: string; onSelect: () => void };
    expect(signOut.label).toBe("layout.signOut");
    signOut.onSelect();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("builds a language sub-menu from the locale options, checked on the preference", () => {
    asRoot();
    const { userItems } = useNav(noop);
    const language = userItems.value[1]![0] as {
      children: { label: string; checked: boolean; onUpdateChecked: (c: boolean) => void }[];
    };
    // system + the two configured locales, each label carrying its flag.
    expect(language.children).toHaveLength(3);
    expect(language.children.map((c) => c.label)).toEqual(["🇬🇧  layout.system", "🇬🇧  English", "🇫🇷  Français"]);
    // preference is "system", so only the first entry is checked.
    expect(language.children.map((c) => c.checked)).toEqual([true, false, false]);
    language.children[2]!.onUpdateChecked(true);
    expect(setLocalePreference).toHaveBeenCalledWith("fr_FR");
  });

  it("reflects the color mode and updates the preference on toggle", () => {
    asRoot();
    const { userItems } = useNav(noop);
    const appearance = userItems.value[1]![1] as {
      children: { label: string; checked: boolean; onUpdateChecked: (c: boolean) => void }[];
    };
    const [light, dark, system] = appearance.children;
    expect(dark!.checked).toBe(true); // colorMode.value === "dark"
    expect(light!.checked).toBe(false);
    expect(system!.checked).toBe(false); // preference !== "system"
    light!.onUpdateChecked(true);
    expect(colorMode.preference).toBe("light");
  });
});
