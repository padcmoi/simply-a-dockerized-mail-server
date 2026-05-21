<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';

interface Domain {
  id: number;
  domain: string;
  quota: number;
  active: number;
  owner_id: number | null;
}
interface ListResp {
  items: Domain[];
  total: number;
}

const { api } = useApi();
const items = ref<Domain[]>([]);
const total = ref(0);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api<ListResp>('/domains');
    items.value = res.items;
    total.value = res.total;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold">Domains</h1>
      <button class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded text-sm">
        New domain
      </button>
    </header>
    <section class="bg-white rounded shadow overflow-hidden">
      <p v-if="loading" class="p-6 text-slate-400">Loading...</p>
      <p v-else-if="error" class="p-6 text-red-600">{{ error }}</p>
      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            <th class="text-left px-4 py-3">Domain</th>
            <th class="text-left px-4 py-3">Quota (bytes)</th>
            <th class="text-left px-4 py-3">Active</th>
            <th class="text-left px-4 py-3">Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in items" :key="d.id" class="border-t border-slate-100">
            <td class="px-4 py-3 font-medium">{{ d.domain }}</td>
            <td class="px-4 py-3">{{ d.quota.toLocaleString() }}</td>
            <td class="px-4 py-3">
              <span
                :class="d.active === 1 ? 'text-green-600' : 'text-slate-400'"
              >{{ d.active === 1 ? 'yes' : 'no' }}</span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ d.owner_id ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
      <footer class="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
        {{ total }} total
      </footer>
    </section>
  </div>
</template>
