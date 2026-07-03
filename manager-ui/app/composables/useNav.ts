import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";
import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";
import { usePermissionsStore } from "~/stores/permissions";

export function useNav(onSignOut: () => Promise<void>) {
  const auth = useAuthStore();
  const perms = usePermissionsStore();
  const domainStore = useDomainStore();
  const { t, locale, locales, setLocale } = useI18n();
  const colorMode = useColorMode();

  const globalNavItems = computed<NavigationMenuItem[]>(() => [
    { label: t("nav.dashboard"), icon: "i-lucide-layout-dashboard", to: "/dashboard" },
    ...(perms.hasGlobal("domains", "view") ? [{ label: t("nav.domains"), icon: "i-lucide-globe", to: "/domains" }] : []),
    ...(perms.hasGlobal("rspamd", "view") ? [{ label: t("nav.rspamd"), icon: "i-lucide-shield", to: "/rspamd" }] : []),
    ...(perms.hasGlobal("postfix", "view") ? [{ label: t("nav.postfix"), icon: "i-lucide-send", to: "/postfix" }] : []),
    ...(perms.hasGlobal("sieve", "view") ? [{ label: t("nav.sieve"), icon: "i-lucide-filter", to: "/sieve" }] : []),
    ...(auth.session?.isRoot || perms.hasGlobal("accounts", "view")
      ? [{ label: t("nav.accounts"), icon: "i-lucide-shield-check", to: "/accounts" }]
      : []),
    ...(auth.session?.isRoot || perms.hasGlobal("groups", "view")
      ? [{ label: t("nav.groups"), icon: "i-lucide-users-round", to: "/groups" }]
      : []),
  ]);

  const domainNavItems = computed<NavigationMenuItem[]>(() => {
    const sel = domainStore.selected;
    if (!sel) return [];
    const domainId = sel.id;
    return [
      ...(perms.hasDomain(domainId, "domain", "view")
        ? [{ label: t("nav.dashboard"), icon: "i-lucide-layout-dashboard", to: `/domains/${sel.domain}` }]
        : []),
      ...(perms.hasDomain(domainId, "recipients", "view")
        ? [{ label: t("nav.recipients"), icon: "i-lucide-users", to: "/recipients" }]
        : []),
      ...(perms.hasDomain(domainId, "aliases", "view")
        ? [{ label: t("nav.aliases"), icon: "i-lucide-at-sign", to: "/aliases" }]
        : []),
      ...(perms.hasDomain(domainId, "quotas", "view")
        ? [{ label: t("nav.quotas"), icon: "i-lucide-bar-chart-3", to: "/quotas" }]
        : []),
    ];
  });

  const userItems = computed<DropdownMenuItem[][]>(() => [
    [
      { label: t("nav.profile"), icon: "i-lucide-user", to: "/profile" },
      ...(auth.session?.isRoot || perms.hasGlobal("api-tokens", "view")
        ? [{ label: t("nav.apiTokens"), icon: "i-lucide-key", to: "/api-tokens" }]
        : []),
    ],
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
        label: t("nav.appearance"),
        icon: "i-lucide-sun-moon",
        children: [
          {
            label: t("nav.light"),
            icon: "i-lucide-sun",
            type: "checkbox",
            checked: colorMode.value === "light",
            onUpdateChecked: (c: boolean) => {
              if (c) colorMode.preference = "light";
            },
            onSelect: (e: Event) => e.preventDefault(),
          },
          {
            label: t("nav.dark"),
            icon: "i-lucide-moon",
            type: "checkbox",
            checked: colorMode.value === "dark",
            onUpdateChecked: (c: boolean) => {
              if (c) colorMode.preference = "dark";
            },
            onSelect: (e: Event) => e.preventDefault(),
          },
          {
            label: t("nav.system"),
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
        label: t("nav.signOut"),
        icon: "i-lucide-log-out",
        onSelect: onSignOut,
      },
    ],
  ]);

  return { globalNavItems, domainNavItems, userItems };
}
