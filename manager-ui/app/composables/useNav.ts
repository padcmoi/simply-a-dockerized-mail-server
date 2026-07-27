import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";
import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";
import { usePermissionsStore } from "~/stores/permissions";

export function useNav(onSignOut: () => Promise<void>) {
  const auth = useAuthStore();
  const perms = usePermissionsStore();
  const domainStore = useDomainStore();
  const route = useRoute();
  const { t } = useI18n();
  const { preference: localePreference, options: localeOptions, setPreference: setLocalePreference } = useLocalePreference();
  const colorMode = useColorMode();

  // Nested account/group detail routes (e.g. /accounts/3/groups) are separate
  // leaf pages, not children of /accounts in the router's matched chain, so
  // NavigationMenuItem's own route-based active detection misses them --
  // this explicit prefix check keeps the parent section highlighted at any
  // depth under it.
  function isActive(to: string) {
    return route.path === to || route.path.startsWith(`${to}/`);
  }

  // A nav entry is shown when the account holds `access` on the resource, and
  // nothing more. There is no generic `read` action any more: every resource
  // names its own listing action (`list-recipients`, `view-postfix-queue`, ...),
  // and a nav helper that iterates resources cannot know which one to ask for.
  //
  // So `access` now means exactly what it says: this resource is visible to me.
  // What its page then shows is gated inside the page by the resource's own
  // listing action -- which is how `domains` already behaved, as the one
  // documented exception. Generalising it removes the exception.
  //
  // `root` ignores groups entirely and has full access to everything (acls.md),
  // so it must bypass this check: a root account has no group and thus no
  // permission rows, and the nav would otherwise collapse to just Dashboard.
  function canAccessGlobal(resource: string) {
    return auth.session?.isRoot === true || perms.hasGlobal(resource, "access");
  }
  function canAccessDomain(domainId: number, resource: string) {
    return auth.session?.isRoot === true || perms.hasDomain(domainId, resource, "access");
  }

  const personalNavItems = computed<NavigationMenuItem[]>(() => [
    { label: t("nav.myspace"), icon: "i-lucide-house", to: "/my-space", active: isActive("/my-space") },
  ]);

  const adminNavItems = computed<NavigationMenuItem[]>(() => [
    ...(canAccessGlobal("domains")
      ? [{ label: t("nav.administration"), icon: "i-lucide-layout-dashboard", to: "/admin", active: route.path === "/admin" }]
      : []),
    ...(canAccessGlobal("domains")
      ? [{ label: t("nav.domains"), icon: "i-lucide-globe", to: "/admin/domains", active: isActive("/admin/domains") }]
      : []),
    ...(canAccessGlobal("rspamd")
      ? [{ label: t("nav.rspamd"), icon: "i-lucide-shield", to: "/admin/rspamd", active: isActive("/admin/rspamd") }]
      : []),
    ...(canAccessGlobal("postfix")
      ? [{ label: t("nav.postfix"), icon: "i-lucide-send", to: "/admin/postfix", active: isActive("/admin/postfix") }]
      : []),
    ...(canAccessGlobal("sieve")
      ? [{ label: t("nav.sieve"), icon: "i-lucide-filter", to: "/admin/sieve", active: isActive("/admin/sieve") }]
      : []),
    ...(canAccessGlobal("accounts")
      ? [{ label: t("nav.accounts"), icon: "i-lucide-shield-check", to: "/admin/accounts", active: isActive("/admin/accounts") }]
      : []),
    ...(canAccessGlobal("groups")
      ? [{ label: t("nav.groups"), icon: "i-lucide-users-round", to: "/admin/groups", active: isActive("/admin/groups") }]
      : []),
    ...(canAccessGlobal("tickets")
      ? [{ label: t("nav.tickets"), icon: "i-lucide-life-buoy", to: "/admin/tickets", active: isActive("/admin/tickets") }]
      : []),
    ...(canAccessGlobal("api-tokens")
      ? [{ label: t("nav.apiTokens"), icon: "i-lucide-key", to: "/admin/api-tokens", active: isActive("/admin/api-tokens") }]
      : []),
    ...(auth.session?.isRoot === true
      ? [{ label: t("nav.config"), icon: "i-lucide-settings-2", to: "/admin/config", active: isActive("/admin/config") }]
      : []),
  ]);

  const domainNavItems = computed<NavigationMenuItem[]>(() => {
    const sel = domainStore.selected;
    if (!sel) return [];
    const domainId = sel.id;
    const domainHome = `/admin/domains/${sel.domain}`;
    return [
      // Exact match only (not the shared prefix-aware `isActive`): this entry
      // now shares its `domainHome` prefix with its 3 siblings below, each
      // with their own entry -- the prefix check exists for sections with no
      // dedicated child entry (see `isActive`'s own comment), which no longer
      // applies here and would otherwise double-highlight this item too.
      ...(canAccessDomain(domainId, "domain")
        ? [{ label: t("nav.dashboard"), icon: "i-lucide-layout-dashboard", to: domainHome, active: route.path === domainHome }]
        : []),
      ...(canAccessDomain(domainId, "recipients")
        ? [
            {
              label: t("nav.recipients"),
              icon: "i-lucide-users",
              to: `${domainHome}/recipients`,
              active: isActive(`${domainHome}/recipients`),
            },
          ]
        : []),
      ...(canAccessDomain(domainId, "aliases")
        ? [
            {
              label: t("nav.aliases"),
              icon: "i-lucide-at-sign",
              to: `${domainHome}/aliases`,
              active: isActive(`${domainHome}/aliases`),
            },
          ]
        : []),
      ...(canAccessDomain(domainId, "quotas")
        ? [
            {
              label: t("nav.quotas"),
              icon: "i-lucide-bar-chart-3",
              to: `${domainHome}/quotas`,
              active: isActive(`${domainHome}/quotas`),
            },
          ]
        : []),
      ...(canAccessDomain(domainId, "admin")
        ? [
            {
              label: t("nav.admin"),
              icon: "i-lucide-shield-alert",
              to: `${domainHome}/app`,
              active: isActive(`${domainHome}/app`),
            },
          ]
        : []),
      ...(canAccessDomain(domainId, "rspamd")
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
    [
      { label: t("layout.profile"), icon: "i-lucide-user", to: "/profile" },
      { label: t("layout.preferences"), icon: "i-lucide-settings", to: "/preferences" },
    ],
    [
      {
        label: t("app.language"),
        icon: "i-lucide-languages",
        children: localeOptions.value.map((o) => ({
          label: `${o.flag}  ${o.name ?? t("layout.system")}`,
          type: "checkbox",
          checked: localePreference.value === o.value,
          onUpdateChecked: (c: boolean) => {
            if (c) setLocalePreference(o.value);
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

  return { personalNavItems, adminNavItems, domainNavItems, userItems };
}
