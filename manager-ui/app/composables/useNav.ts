import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";
import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";
import { usePermissionsStore } from "~/stores/permissions";

export function useNav(onSignOut: () => Promise<void>) {
  const auth = useAuthStore();
  const perms = usePermissionsStore();
  const domainStore = useDomainStore();
  const route = useRoute();
  const { t, locale, locales, setLocale } = useI18n();
  const colorMode = useColorMode();

  // Nested account/group detail routes (e.g. /accounts/3/groups) are separate
  // leaf pages, not children of /accounts in the router's matched chain, so
  // NavigationMenuItem's own route-based active detection misses them --
  // this explicit prefix check keeps the parent section highlighted at any
  // depth under it.
  function isActive(to: string) {
    return route.path === to || route.path.startsWith(`${to}/`);
  }

  // A nav entry is only worth showing if the account can both see it exists (`access`)
  // and actually read its content (`read`), matching each page's `requiredGlobal`/
  // `requiredDomain` meta, which requires both. `root` ignores groups entirely and
  // has full access to everything (acls.md), so it must bypass every one of these
  // checks, not just a couple: a root account has no group and thus no permission
  // rows, so without this bypass the whole nav would collapse to just Dashboard.
  function canViewGlobal(resource: string) {
    return auth.session?.isRoot === true || (perms.hasGlobal(resource, "access") && perms.hasGlobal(resource, "read"));
  }
  // Domains is the one nav entry with a lower bar: `access` alone is enough
  // to reach the page (it shows the disk capacity overview even without
  // `read`); the domain list itself still requires `read`, gated inside the
  // page, not at the nav/page-meta level.
  function canAccessGlobal(resource: string) {
    return auth.session?.isRoot === true || perms.hasGlobal(resource, "access");
  }
  function canViewDomain(domainId: number, resource: string) {
    return (
      auth.session?.isRoot === true ||
      (perms.hasDomain(domainId, resource, "access") && perms.hasDomain(domainId, resource, "read"))
    );
  }

  const globalNavItems = computed<NavigationMenuItem[]>(() => [
    { label: t("nav.dashboard"), icon: "i-lucide-layout-dashboard", to: "/dashboard", active: isActive("/dashboard") },
    ...(canAccessGlobal("domains")
      ? [{ label: t("nav.domains"), icon: "i-lucide-globe", to: "/domains", active: isActive("/domains") }]
      : []),
    ...(canViewGlobal("rspamd")
      ? [{ label: t("nav.rspamd"), icon: "i-lucide-shield", to: "/rspamd", active: isActive("/rspamd") }]
      : []),
    ...(canViewGlobal("postfix")
      ? [{ label: t("nav.postfix"), icon: "i-lucide-send", to: "/postfix", active: isActive("/postfix") }]
      : []),
    ...(canViewGlobal("sieve")
      ? [{ label: t("nav.sieve"), icon: "i-lucide-filter", to: "/sieve", active: isActive("/sieve") }]
      : []),
    ...(canViewGlobal("accounts")
      ? [{ label: t("nav.accounts"), icon: "i-lucide-shield-check", to: "/accounts", active: isActive("/accounts") }]
      : []),
    ...(canViewGlobal("groups")
      ? [{ label: t("nav.groups"), icon: "i-lucide-users-round", to: "/groups", active: isActive("/groups") }]
      : []),
    ...(auth.session?.isRoot || canViewGlobal("api-tokens")
      ? [{ label: t("nav.apiTokens"), icon: "i-lucide-key", to: "/api-tokens", active: isActive("/api-tokens") }]
      : []),
  ]);

  const domainNavItems = computed<NavigationMenuItem[]>(() => {
    const sel = domainStore.selected;
    if (!sel) return [];
    const domainId = sel.id;
    const domainHome = `/domains/${sel.domain}`;
    return [
      // Exact match only (not the shared prefix-aware `isActive`): this entry
      // now shares its `domainHome` prefix with its 3 siblings below, each
      // with their own entry -- the prefix check exists for sections with no
      // dedicated child entry (see `isActive`'s own comment), which no longer
      // applies here and would otherwise double-highlight this item too.
      ...(canViewDomain(domainId, "domain")
        ? [{ label: t("nav.dashboard"), icon: "i-lucide-layout-dashboard", to: domainHome, active: route.path === domainHome }]
        : []),
      ...(canViewDomain(domainId, "recipients")
        ? [
            {
              label: t("nav.recipients"),
              icon: "i-lucide-users",
              to: `${domainHome}/recipients`,
              active: isActive(`${domainHome}/recipients`),
            },
          ]
        : []),
      ...(canViewDomain(domainId, "aliases")
        ? [
            {
              label: t("nav.aliases"),
              icon: "i-lucide-at-sign",
              to: `${domainHome}/aliases`,
              active: isActive(`${domainHome}/aliases`),
            },
          ]
        : []),
      ...(canViewDomain(domainId, "quotas")
        ? [
            {
              label: t("nav.quotas"),
              icon: "i-lucide-bar-chart-3",
              to: `${domainHome}/quotas`,
              active: isActive(`${domainHome}/quotas`),
            },
          ]
        : []),
      ...(canViewDomain(domainId, "admin")
        ? [
            {
              label: t("nav.admin"),
              icon: "i-lucide-shield-alert",
              to: `${domainHome}/app`,
              active: isActive(`${domainHome}/app`),
            },
          ]
        : []),
      ...(canViewDomain(domainId, "rspamd")
        ? [
            {
              label: t("nav.rspamd"),
              icon: "i-lucide-shield",
              to: `${domainHome}/rspamd`,
              active: isActive(`${domainHome}/rspamd`),
            },
          ]
        : []),
    ];
  });

  const userItems = computed<DropdownMenuItem[][]>(() => [
    [{ label: t("layout.profile"), icon: "i-lucide-user", to: "/profile" }],
    [
      {
        label: t("app.language"),
        icon: "i-lucide-languages",
        children: locales.value.map((l) => ({
          label: l.name ?? l.code,
          icon: "i-lucide-globe",
          type: "checkbox",
          checked: locale.value === l.code,
          onUpdateChecked: (c: boolean) => {
            if (c) setLocale(l.code);
          },
          onSelect: (e: Event) => e.preventDefault(),
        })),
      },
      {
        label: t("layout.appearance"),
        icon: "i-lucide-sun-moon",
        children: [
          {
            label: t("layout.light"),
            icon: "i-lucide-sun",
            type: "checkbox",
            checked: colorMode.value === "light",
            onUpdateChecked: (c: boolean) => {
              if (c) colorMode.preference = "light";
            },
            onSelect: (e: Event) => e.preventDefault(),
          },
          {
            label: t("layout.dark"),
            icon: "i-lucide-moon",
            type: "checkbox",
            checked: colorMode.value === "dark",
            onUpdateChecked: (c: boolean) => {
              if (c) colorMode.preference = "dark";
            },
            onSelect: (e: Event) => e.preventDefault(),
          },
          {
            label: t("layout.system"),
            icon: "i-lucide-monitor",
            type: "checkbox",
            checked: colorMode.preference === "system",
            onUpdateChecked: (c: boolean) => {
              if (c) colorMode.preference = "system";
            },
            onSelect: (e: Event) => e.preventDefault(),
          },
        ],
      },
    ],
    [
      {
        label: t("layout.signOut"),
        icon: "i-lucide-log-out",
        onSelect: onSignOut,
      },
    ],
  ]);

  return { globalNavItems, domainNavItems, userItems };
}
