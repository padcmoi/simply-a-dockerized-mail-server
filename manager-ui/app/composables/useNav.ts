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

  // One entry, when the account holds `access` on the resource behind it.
  function entry(resource: string, label: string, icon: string, to: string) {
    return canAccessGlobal(resource) ? [{ label: t(label), icon, to, active: isActive(to) }] : [];
  }

  // Eleven entries in one column is a list that gets scanned rather than read.
  // What is opened every day stays at the top level; the rest is folded into
  // sections named after what they hold, which the sidebar opens by itself when
  // the page on screen is one of theirs.
  //
  // A section of one is that one entry: a folder around a single page is a click
  // for nothing, and permissions alone can leave a section with one visible page.
  function section(value: string, label: string, icon: string, children: NavigationMenuItem[]) {
    if (children.length < 2) return children;
    return [{ value, label: t(label), icon, children, active: children.some((child) => child.active === true) }];
  }

  const personalNavItems = computed<NavigationMenuItem[]>(() => [
    { label: t("nav.myspace"), icon: "i-lucide-house", to: "/my-space", active: isActive("/my-space") },
  ]);

  const adminNavItems = computed<NavigationMenuItem[]>(() => [
    ...(canAccessGlobal("domains")
      ? [{ label: t("nav.administration"), icon: "i-lucide-layout-dashboard", to: "/admin", active: route.path === "/admin" }]
      : []),
    ...entry("domains", "nav.domains", "i-lucide-globe", "/admin/domains"),
    ...entry("tickets", "nav.tickets", "i-lucide-life-buoy", "/admin/tickets"),
    ...section("mail", "nav.sectionMail", "i-lucide-mail-check", [
      ...entry("rspamd", "nav.rspamd", "i-lucide-shield", "/admin/rspamd"),
      ...entry("postfix", "nav.postfix", "i-lucide-send", "/admin/postfix"),
      ...entry("sieve", "nav.sieve", "i-lucide-filter", "/admin/sieve"),
    ]),
    ...section("access", "nav.sectionAccess", "i-lucide-shield-check", [
      ...entry("accounts", "nav.accounts", "i-lucide-user-cog", "/admin/accounts"),
      ...entry("groups", "nav.groups", "i-lucide-users-round", "/admin/groups"),
      ...entry("api-tokens", "nav.apiTokens", "i-lucide-key", "/admin/api-tokens"),
    ]),
    ...section("system", "nav.sectionSystem", "i-lucide-settings-2", [
      ...(auth.session?.isRoot === true
        ? [
            {
              label: t("nav.config"),
              icon: "i-lucide-sliders-horizontal",
              to: "/admin/config",
              active: isActive("/admin/config"),
            },
          ]
        : []),
      ...entry("supervision", "nav.supervision", "i-lucide-activity", "/admin/supervision"),
    ]),
  ]);

  // Which sections are unfolded. Held here rather than left to the menu's own
  // default, which is read once at mount: the sidebar is never remounted, so a
  // section holding the page just navigated to would stay shut over it.
  const openAdminSections = ref<string[]>([]);

  const activeAdminSection = computed(
    () => adminNavItems.value.find((item) => item.children?.length && item.active === true)?.value
  );

  // Opened for you when you land in it, and never closed for you: a section
  // someone folded by hand stays folded until they are somewhere else.
  watch(
    activeAdminSection,
    (value) => {
      if (typeof value === "string" && !openAdminSections.value.includes(value)) {
        openAdminSections.value = [...openAdminSections.value, value];
      }
    },
    { immediate: true }
  );

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
      ...(canAccessDomain(domainId, "recipients") && canAccessDomain(domainId, "aliases")
        ? [
            {
              label: t("nav.delegations"),
              icon: "i-lucide-user-plus",
              to: `${domainHome}/delegations`,
              active: isActive(`${domainHome}/delegations`),
            },
          ]
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
      // Deselecting the domain is an entry of its own menu, not a cross in the
      // header: it clears the selection and lands on the domains list.
      {
        label: t("nav.closeDomain"),
        icon: "i-lucide-x",
        to: "/admin/domains",
        onSelect: () => {
          domainStore.clear();
        },
      },
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

  return { personalNavItems, adminNavItems, openAdminSections, domainNavItems, userItems };
}
