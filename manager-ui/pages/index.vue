<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';

interface HealthResponse {
  status: string;
  info?: Record<string, { status: string }>;
}

const { api } = useApi();
const health = ref<HealthResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    health.value = await api<HealthResponse>('/health');
  } catch (e) {
    error.value = (e as Error).message;
  }
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold mb-6">Dashboard</h1>
    <section class="bg-white rounded shadow p-6">
      <h2 class="text-sm font-medium text-slate-500 uppercase mb-3">manager-api health</h2>
      <pre v-if="health" class="text-xs bg-slate-50 p-3 rounded overflow-x-auto">{{
        JSON.stringify(health, null, 2)
      }}</pre>
      <p v-else-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <p v-else class="text-slate-400 text-sm">Loading...</p>
    </section>
  </div>
</template>
