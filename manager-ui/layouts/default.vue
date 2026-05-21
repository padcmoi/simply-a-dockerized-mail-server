<script setup lang="ts">
import { useAuth } from '~/composables/useAuth';

const { isAuthenticated, principal, logout } = useAuth();
const route = useRoute();
const isLogin = computed(() => route.path === '/login');

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/domains', label: 'Domains' },
  { to: '/users', label: 'Mailboxes' },
  { to: '/aliases', label: 'Aliases' },
];
</script>

<template>
  <div v-if="isLogin" class="min-h-full"><slot /></div>
  <div v-else class="min-h-full flex">
    <aside class="w-60 bg-slate-900 text-slate-100 p-5 flex flex-col">
      <div class="text-lg font-semibold mb-8">Mail manager</div>
      <nav class="flex flex-col gap-2 text-sm">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-slate-800"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="mt-auto text-xs text-slate-400">
        <div v-if="isAuthenticated">{{ principal?.email }}</div>
        <button class="mt-2 text-slate-300 hover:text-white" @click="logout()">Sign out</button>
      </div>
    </aside>
    <main class="flex-1 p-8 overflow-y-auto"><slot /></main>
  </div>
</template>
