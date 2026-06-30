<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";
import { useAuthStore } from "~/stores/auth";

const open = ref(true);

const navItems = computed<NavigationMenuItem[]>(() => [
  { label: "Dashboard", icon: "i-lucide-layout-dashboard", to: "/dashboard" },
  { label: "Domains", icon: "i-lucide-globe", to: "/domains" },
  { label: "Recipients", icon: "i-lucide-users", to: "/recipients" },
  { label: "Aliases", icon: "i-lucide-at-sign", to: "/aliases" },
  { label: "Quotas", icon: "i-lucide-bar-chart-3", to: "/quotas" },
  { label: "Sieve", icon: "i-lucide-filter", to: "/sieve" },
]);

const userItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: "Profile", icon: "i-lucide-user", to: "/profile" }],
  [
    {
      label: "Appearance",
      icon: "i-lucide-sun-moon",
      children: [
        {
          label: "Light",
          icon: "i-lucide-sun",
          type: "checkbox",
          checked: colorMode.value === "light",
          onUpdateChecked: (c: boolean) => {
            if (c) colorMode.preference = "light";
          },
          onSelect: (e: Event) => e.preventDefault(),
        },
        {
          label: "Dark",
          icon: "i-lucide-moon",
          type: "checkbox",
          checked: colorMode.value === "dark",
          onUpdateChecked: (c: boolean) => {
            if (c) colorMode.preference = "dark";
          },
          onSelect: (e: Event) => e.preventDefault(),
        },
        {
          label: "System",
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
      label: "Sign out",
      icon: "i-lucide-log-out",
      onSelect: async () => {
        await auth.logout();
        await navigateTo("/login");
      },
    },
  ],
]);

const headerTitle = computed(() => {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/domains": "Domains",
    "/recipients": "Recipients",
    "/aliases": "Aliases",
    "/quotas": "Quotas",
    "/sieve": "Sieve - Rejected senders",
    "/profile": "Profile",
  };
  for (const k of Object.keys(map)) if (route.path.startsWith(k)) return map[k];
  return "Mail Manager";
});

const userAvatar = computed(() => {
  const url = auth.session?.avatarUrl;
  if (url) return { src: url, alt: auth.session?.name ?? auth.session?.username ?? "user" };
  return { alt: auth.session?.name ?? auth.session?.username ?? "?" };
});

const auth = useAuthStore();
const route = useRoute();
const colorMode = useColorMode();

function toggleSidebar() {
  open.value = !open.value;
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
          label="Mail Manager"
          color="neutral"
          variant="ghost"
          square
          to="/dashboard"
          class="w-full overflow-hidden"
          :ui="{ leadingIcon: 'text-primary' }"
        />
      </template>

      <template #default="{ state }">
        <UNavigationMenu :key="state" :items="navItems" orientation="vertical" :ui="{ link: 'p-1.5 overflow-hidden' }" />
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
        <UButton icon="i-lucide-panel-left" color="neutral" variant="ghost" aria-label="Toggle sidebar" @click="toggleSidebar" />
        <USeparator orientation="vertical" class="h-5" />
        <h1 class="font-semibold truncate">{{ headerTitle }}</h1>
      </div>

      <div class="flex-1 min-w-0">
        <slot />
      </div>
    </div>
  </div>
</template>
