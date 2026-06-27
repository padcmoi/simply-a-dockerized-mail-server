<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const auth = useAuthStore();
const route = useRoute();

const links = [
  { label: "Domains", to: "/domains", icon: "i-lucide-globe" },
  { label: "Users", to: "/users", icon: "i-lucide-users" },
  { label: "Aliases", to: "/aliases", icon: "i-lucide-at-sign" },
  { label: "Quotas", to: "/quotas", icon: "i-lucide-bar-chart-3" },
  { label: "Sieve", to: "/sieve", icon: "i-lucide-filter" },
];

async function onLogout() {
  await auth.logout();
  await navigateTo("/login");
}
</script>

<template>
  <div class="min-h-dvh bg-neutral-50 dark:bg-neutral-950 flex flex-col md:flex-row">
    <aside
      class="md:w-64 md:min-h-dvh bg-white dark:bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-2"
    >
      <div class="text-lg font-semibold mb-4">Mail Manager</div>
      <UButton
        v-for="l in links"
        :key="l.to"
        :icon="l.icon"
        :label="l.label"
        :to="l.to"
        variant="ghost"
        class="justify-start"
        :color="route.path.startsWith(l.to) ? 'primary' : 'neutral'"
      />
      <div class="grow" />
      <UButton
        v-if="auth.isAuthenticated"
        icon="i-lucide-log-out"
        label="Logout"
        color="neutral"
        variant="ghost"
        class="justify-start"
        @click="onLogout"
      />
    </aside>
    <main class="flex-1 p-4 md:p-8">
      <slot />
    </main>
  </div>
</template>
