import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NavigationMenuItem } from "@nuxt/ui";
import { ref, reactive } from "vue";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

// useNav statically imports the domain store, whose module calls the bare
// `defineStore` auto-import at eval time -- stub it before the dynamic import.
vi.stubGlobal("defineStore", defineStore);
const unread = ref(0);
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
  // A flag is an icon from the `circle-flags` collection, not an emoji: the
  // composable hands out a region code and useNav turns it into an icon name.
  vi.stubGlobal("countryFlagIcon", (c: string) => `i-circle-flags-${c.toLowerCase()}`);
  // The language sub-menu now goes through useLocalePreference (tri-state, with a
  // "system" entry), so stub it: preference "system", three flagged options.
  vi.stubGlobal("useLocalePreference", () => ({
    preference: ref("system"),
    resolved: ref("en_GB"),
    detected: ref("en_GB"),
    options: ref([
      { value: "system", flag: "GB", name: null },
      { value: "en_GB", flag: "GB", name: "English" },
      { value: "fr_FR", flag: "FR", name: "Français" },
    ]),
    availableCodes: ref(["en_GB", "fr_FR"]),
    flagFor: (c: string) => c,
    detectBrowserLocale: () => "en_GB",
    apply: vi.fn(),
    setPreference: setLocalePreference,
  }));
  vi.stubGlobal("useColorMode", () => colorMode);
  vi.stubGlobal("useRoute", () => ({ path: "/" }));
  unread.value = 0;
  vi.stubGlobal("useNotifications", () => ({ unread }));
});

function asRoot() {
  useAuthStore().session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io", isRoot: true };
}
function asUser() {
  useAuthStore().session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io", isRoot: false };
}
const noop = async () => {};

// Every page the sidebar links to, folded sections included.
function pathsOf(items: NavigationMenuItem[]) {
  return items.flatMap((item) => (item.children ? item.children.map((child) => child.to) : [item.to]));
}

describe("useNav global nav items", () => {
  // Eleven entries in one column is a list that gets scanned rather than read:
  // the pages opened every day stay at the top, the rest is folded into three
  // named sections. Nothing is lost, only folded.
  it("lists every admin page for a root account (perms bypassed)", () => {
    asRoot();
    const { adminNavItems } = useNav(noop);
    expect(adminNavItems.value.map((i) => i.to ?? i.value)).toEqual([
      "/admin",
      "/admin/domains",
      "/admin/tickets",
      "mail",
      "access",
      "system",
    ]);
    expect(pathsOf(adminNavItems.value)).toEqual([
      "/admin",
      "/admin/domains",
      "/admin/tickets",
      "/admin/rspamd",
      "/admin/postfix",
      "/admin/sieve",
      "/admin/accounts",
      "/admin/groups",
      "/admin/api-tokens",
      "/admin/config",
      "/admin/supervision",
      "/admin/activity",
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
    expect(adminNavItems.value.map((i) => i.value)).toEqual(["access"]);
    expect(pathsOf(adminNavItems.value)).toEqual(["/admin/accounts", "/admin/groups"]);
  });

  // The machine is gated like any other section: on `access` alone. A non-root
  // account sees nothing else under System, and a folder around a single page is
  // a click for nothing, so the entry stands on its own.
  it("reveals the machine section on supervision access, root or not", () => {
    asUser();
    usePermissionsStore().data = { global: [{ resource: "supervision", action: "access" }], domain: [] };
    const { adminNavItems } = useNav(noop);
    expect(adminNavItems.value.map((i) => i.to)).toEqual(["/admin/supervision"]);
    expect(adminNavItems.value[0]?.children).toBeUndefined();
  });

  // A section holding the page on screen has to be open, or the sidebar hides
  // where you are. The menu reads its own default once at mount and the sidebar
  // is never remounted, so the open sections are held here instead.
  it("opens the section holding the current page, and marks it active", () => {
    asRoot();
    vi.stubGlobal("useRoute", () => ({ path: "/admin/config/theme" }));
    const { adminNavItems, openAdminSections } = useNav(noop);
    expect(openAdminSections.value).toEqual(["system"]);
    const system = adminNavItems.value.find((i) => i.value === "system");
    expect(system?.active).toBe(true);
    expect(adminNavItems.value.find((i) => i.value === "mail")?.active).toBe(false);
  });

  it("leaves every section folded on a page that belongs to none", () => {
    asRoot();
    vi.stubGlobal("useRoute", () => ({ path: "/admin" }));
    const { openAdminSections } = useNav(noop);
    expect(openAdminSections.value).toEqual([]);
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
      "/admin/domains/example.com/delegations",
      "/admin/domains/example.com/recipients",
      "/admin/domains/example.com/aliases",
      "/admin/domains/example.com/quotas",
      "/admin/domains/example.com/app",
      "/admin/domains/example.com/deliverability",
      "/admin/domains/example.com/rspamd",
      "/admin/domains",
    ]);
  });

  // Running the diagnostics is a global right: access to the domain alone does
  // not put the entry in the menu, and holding the right without the domain
  // does not either.
  it("shows the deliverability entry only with the global right AND access to the domain", () => {
    asUser();
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });

    usePermissionsStore().data = {
      global: [],
      domain: [{ domainId: 1, domainName: "example.com", resource: "domain", action: "access" }],
    };
    const withoutRight = useNav(noop).domainNavItems.value.map((i) => i.to);
    expect(withoutRight).not.toContain("/admin/domains/example.com/deliverability");

    usePermissionsStore().data = {
      global: [{ resource: "deliverability", action: "access" }],
      domain: [{ domainId: 1, domainName: "example.com", resource: "domain", action: "access" }],
    };
    const withRight = useNav(noop).domainNavItems.value.map((i) => i.to);
    expect(withRight).toContain("/admin/domains/example.com/deliverability");
  });

  it("filters domain sections by per-domain `access` for a non-root account", () => {
    asUser();
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    usePermissionsStore().data = {
      global: [],
      domain: [{ domainId: 1, domainName: "example.com", resource: "recipients", action: "access" }],
    };
    const { domainNavItems } = useNav(noop);
    expect(domainNavItems.value.map((i) => i.to)).toEqual(["/admin/domains/example.com/recipients", "/admin/domains"]);
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

  it("offers a shortcut to the notification history, next to the profile", () => {
    asRoot();
    const { userItems } = useNav(noop);
    const entry = userItems.value[0]![1] as { label: string; to: string; icon: string };
    expect(entry.to).toBe("/notifications");
    expect(entry.icon).toBe("i-lucide-bell");
    expect(entry.label).toBe("notifications.title");
  });

  it("carries the unread count in that entry's own label", () => {
    asRoot();
    unread.value = 3;
    const { userItems } = useNav(noop);
    expect((userItems.value[0]![1] as { label: string }).label).toBe("notifications.title (3)");
  });

  it("builds a language sub-menu from the locale options, checked on the preference", () => {
    asRoot();
    const { userItems } = useNav(noop);
    const language = userItems.value[1]![0] as {
      children: { label: string; icon: string; checked: boolean; onUpdateChecked: (c: boolean) => void }[];
    };
    // system + the two configured locales, each carrying its flag as an icon.
    expect(language.children).toHaveLength(3);
    expect(language.children.map((c) => c.label)).toEqual(["layout.system", "English", "Français"]);
    expect(language.children.map((c) => c.icon)).toEqual(["i-circle-flags-gb", "i-circle-flags-gb", "i-circle-flags-fr"]);
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
