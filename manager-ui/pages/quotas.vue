<script setup lang="ts">
interface Q { id: number; domain: string; email?: string; bytes: string; messages: string; lastActivity: string }

const { call } = useApi()
const domains = ref<Q[]>([])
const users = ref<Q[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    domains.value = await call<Q[]>('/quotas/domains')
    users.value = await call<Q[]>('/quotas/users')
  } finally { loading.value = false }
}
onMounted(load)

const domainCols = [
  { accessorKey: 'domain', header: 'Domain' },
  { accessorKey: 'bytes', header: 'Bytes' },
  { accessorKey: 'messages', header: 'Messages' },
  { accessorKey: 'lastActivity', header: 'Last activity' },
]
const userCols = [
  { accessorKey: 'email', header: 'Mailbox' },
  { accessorKey: 'bytes', header: 'Bytes' },
  { accessorKey: 'messages', header: 'Messages' },
  { accessorKey: 'lastActivity', header: 'Last activity' },
]
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Quotas</h1>
      <UButton icon="i-lucide-refresh-cw" variant="ghost" :loading="loading" @click="load">Refresh</UButton>
    </div>
    <section class="space-y-2">
      <h2 class="text-lg font-medium">Per domain</h2>
      <UTable :columns="domainCols" :data="domains" :loading="loading" />
    </section>
    <section class="space-y-2">
      <h2 class="text-lg font-medium">Per mailbox</h2>
      <UTable :columns="userCols" :data="users" :loading="loading" />
    </section>
  </div>
</template>
