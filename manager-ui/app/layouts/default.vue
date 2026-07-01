<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";
import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";

const open = ref(true);

const domainStore = useDomainStore();

const globalNavItems = computed<NavigationMenuItem[]>(() => [
  { label: t("nav.dashboard"), icon: "i-lucide-layout-dashboard", to: "/dashboard" },
  { label: t("nav.domains"), icon: "i-lucide-globe", to: "/domains" },
]);

const domainNavItems = computed<NavigationMenuItem[]>(() => {
  if (!domainStore.selected) return [];
  return [
    { label: t("nav.dashboard"), icon: "i-lucide-layout-dashboard", to: `/domains/${domainStore.selected.domain}` },
    { label: t("nav.recipients"), icon: "i-lucide-users", to: "/recipients" },
    { label: t("nav.aliases"), icon: "i-lucide-at-sign", to: "/aliases" },
    { label: t("nav.quotas"), icon: "i-lucide-bar-chart-3", to: "/quotas" },
  ];
});

const bottomNavItems = computed<NavigationMenuItem[]>(() => [
  { label: t("nav.sieve"), icon: "i-lucide-filter", to: "/sieve" },
  ...(auth.session?.isRoot ? [{ label: t("nav.accounts"), icon: "i-lucide-shield-check", to: "/accounts" }] : []),
]);

const userItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: t("nav.profile"), icon: "i-lucide-user", to: "/profile" }],
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
      onSelect: async () => {
        await auth.logout();
        await navigateTo("/login");
      },
    },
  ],
]);

const headerTitle = computed(() => {
  if (route.path.startsWith("/domains/") && domainStore.selected) return domainStore.selected.domain;
  const map: Record<string, string> = {
    "/dashboard": t("nav.dashboard"),
    "/domains": t("nav.domains"),
    "/recipients": t("nav.recipients"),
    "/aliases": t("nav.aliases"),
    "/quotas": t("nav.quotas"),
    "/sieve": t("nav.sieveLong"),
    "/accounts": t("nav.accounts"),
    "/profile": t("nav.profile"),
  };
  for (const k of Object.keys(map)) if (route.path.startsWith(k)) return map[k];
  return t("app.name");
});

const userAvatar = computed(() => {
  const url = auth.session?.avatarUrl;
  if (url) return { src: url, alt: auth.session?.name ?? auth.session?.username ?? "user" };
  return { alt: auth.session?.name ?? auth.session?.username ?? "?" };
});

const { t, locale, locales, setLocale } = useI18n();
const route = useRoute();
const colorMode = useColorMode();
const auth = useAuthStore();

function toggleSidebar() {
  open.value = !open.value;
}

function closeDomain() {
  domainStore.clear();
  navigateTo("/domains");
}
</script>

<template>
  <div class="flex flex-1 min-h-dvh">
    <USidebar
      v-model:open="open"
      collapsible="icon"
      rail
      :ui="{
        container: 'h-full',
        inner: 'bg-elevated/25 divide-transparent',
        body: 'py-0',
      }"
    >
      <template #header>
        <UButton
          icon="i-lucide-mail"
          :label="t('app.name')"
          color="neutral"
          variant="ghost"
          square
          to="/dashboard"
          class="w-full overflow-hidden"
          :ui="{ leadingIcon: 'text-primary' }"
        />
      </template>

      <template #default="{ state }">
        <UNavigationMenu
          :key="`global-${state}`"
          :items="globalNavItems"
          orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }"
        />

        <template v-if="domainStore.selected">
          <USeparator class="my-2" />
          <div class="flex items-center gap-1.5 px-1.5 py-1 min-w-0">
            <NuxtLink :to="`/domains/${domainStore.selected.domain}`" class="flex items-center gap-1.5 min-w-0 flex-1 group">
              <UIcon name="i-lucide-folder-open" class="text-primary shrink-0 size-4" />
              <span v-if="open" class="text-xs font-semibold truncate text-muted group-hover:text-primary transition-colors">
                {{ domainStore.selected.domain }}
              </span>
            </NuxtLink>
            <UButton
              v-if="open"
              icon="i-lucide-x"
              size="2xs"
              color="neutral"
              variant="ghost"
              square
              class="shrink-0"
              @click="closeDomain"
            />
          </div>
          <UNavigationMenu
            :key="`domain-${state}`"
            :items="domainNavItems"
            orientation="vertical"
            :ui="{ link: 'p-1.5 overflow-hidden' }"
          />
        </template>

        <USeparator class="my-2" />
        <UNavigationMenu
          :key="`bottom-${state}`"
          :items="bottomNavItems"
          orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }"
        />
      </template>

      <template #footer>
        <UDropdownMenu
          :items="userItems"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
        >
          <UButton
            :avatar="userAvatar"
            :label="auth.session?.name ?? auth.session?.username ?? 'Account'"
            trailing-icon="i-lucide-chevrons-up-down"
            color="neutral"
            variant="ghost"
            square
            class="w-full data-[state=open]:bg-elevated overflow-hidden"
            :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
          />
        </UDropdownMenu>
      </template>
    </USidebar>

    <div class="flex-1 flex flex-col min-w-0">
      <div class="h-(--ui-header-height) shrink-0 flex items-center gap-2 px-4 border-b border-default">
        <UButton
          icon="i-lucide-panel-left"
          color="neutral"
          variant="ghost"
          :aria-label="t('nav.toggleSidebar')"
          @click="toggleSidebar"
        />
        <USeparator orientation="vertical" class="h-5" />
        <h1 class="font-semibold truncate">{{ headerTitle }}</h1>
      </div>

      <BreadcrumbProvider>
        <slot />
      </BreadcrumbProvider>
    </div>
  </div>
</template>
