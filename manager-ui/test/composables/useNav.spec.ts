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

let setLocale: ReturnType<typeof vi.fn>;
let colorMode: { value: string; preference: string };

beforeEach(() => {
  setActivePinia(createPinia());
  setLocale = vi.fn();
  colorMode = reactive({ value: "dark", preference: "dark" });
  vi.stubGlobal("useI18n", () => ({
    t: (k: string) => k,
    locale: ref("en"),
    locales: ref([
      { code: "en", name: "English" },
      { code: "fr", name: "Français" },
    ]),
    setLocale,
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
  it("shows every section for a root account (perms bypassed)", () => {
    asRoot();
    const { globalNavItems } = useNav(noop);
    expect(globalNavItems.value.map((i) => i.to)).toEqual([
      "/dashboard",
      "/domains",
      "/rspamd",
      "/postfix",
      "/sieve",
      "/accounts",
      "/groups",
      "/api-tokens",
    ]);
  });

  it("shows only the dashboard for a permissionless non-root account", () => {
    asUser();
    const { globalNavItems } = useNav(noop);
    expect(globalNavItems.value.map((i) => i.to)).toEqual(["/dashboard"]);
  });

  it("reveals exactly the sections the account holds `access` on", () => {
    asUser();
    usePermissionsStore().data = {
      global: [
        { resource: "accounts", action: "access" },
        { resource: "groups", action: "access" },
      ],
      domain: [],
    };
    const { globalNavItems } = useNav(noop);
    expect(globalNavItems.value.map((i) => i.to)).toEqual(["/dashboard", "/accounts", "/groups"]);
  });

  it("marks the section active with a prefix-aware match on the route path", () => {
    asRoot();
    vi.stubGlobal("useRoute", () => ({ path: "/domains/example.com" }));
    const { globalNavItems } = useNav(noop);
    const byTo = Object.fromEntries(globalNavItems.value.map((i) => [i.to, i.active]));
    expect(byTo["/domains"]).toBe(true);
    expect(byTo["/dashboard"]).toBe(false);
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
      "/domains/example.com",
      "/domains/example.com/recipients",
      "/domains/example.com/aliases",
      "/domains/example.com/quotas",
      "/domains/example.com/app",
      "/domains/example.com/rspamd",
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
    expect(domainNavItems.value.map((i) => i.to)).toEqual(["/domains/example.com/recipients"]);
  });

  it("highlights the domain home only on an exact path match", () => {
    asRoot();
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    vi.stubGlobal("useRoute", () => ({ path: "/domains/example.com" }));
    const { domainNavItems } = useNav(noop);
    const home = domainNavItems.value.find((i) => i.to === "/domains/example.com");
    const recipients = domainNavItems.value.find((i) => i.to === "/domains/example.com/recipients");
    expect(home?.active).toBe(true);
    expect(recipients?.active).toBe(false);
  });
});

describe("useNav user menu", () => {
  it("wires the sign-out entry to the supplied callback", () => {
    asRoot();
    const onSignOut = vi.fn();
    const { userItems } = useNav(onSignOut);
    const signOut = userItems.value[2][0] as { label: string; onSelect: () => void };
    expect(signOut.label).toBe("layout.signOut");
    signOut.onSelect();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("builds a language sub-menu checked on the active locale, switching on check", () => {
    asRoot();
    const { userItems } = useNav(noop);
    const language = userItems.value[1][0] as {
      children: { label: string; checked: boolean; onUpdateChecked: (c: boolean) => void }[];
    };
    expect(language.children.map((c) => c.label)).toEqual(["English", "Français"]);
    expect(language.children[0].checked).toBe(true); // active locale "en"
    expect(language.children[1].checked).toBe(false);
    language.children[1].onUpdateChecked(true);
    expect(setLocale).toHaveBeenCalledWith("fr");
  });

  it("reflects the color mode and updates the preference on toggle", () => {
    asRoot();
    const { userItems } = useNav(noop);
    const appearance = userItems.value[1][1] as {
      children: { label: string; checked: boolean; onUpdateChecked: (c: boolean) => void }[];
    };
    const [light, dark, system] = appearance.children;
    expect(dark.checked).toBe(true); // colorMode.value === "dark"
    expect(light.checked).toBe(false);
    expect(system.checked).toBe(false); // preference !== "system"
    light.onUpdateChecked(true);
    expect(colorMode.preference).toBe("light");
  });
});
