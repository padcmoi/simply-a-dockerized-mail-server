<script setup lang="ts">
interface Reject { id: number; sender: string; enabled: number; dateCreation: string }

const { call } = useApi()
const toast = useToast()
const items = ref<Reject[]>([])
const loading = ref(false)
const form = reactive({ sender: '' })

async function load() {
  loading.value = true
  try { items.value = await call<Reject[]>('/sieve/reject-senders') } finally { loading.value = false }
}
onMounted(load)

async function create() {
  try {
    await call('/sieve/reject-senders', { method: 'POST', body: form })
    form.sender = ''
    await load()
    toast.add({ title: 'Sender blocked', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Failed', description: (err as Error).message, color: 'error' })
  }
}
async function toggle(id: number, enabled: number) {
  await call(`/sieve/reject-senders/${id}`, { method: 'PATCH', body: { enabled: !enabled } })
  await load()
}
async function remove(id: number) {
  await call(`/sieve/reject-senders/${id}`, { method: 'DELETE' })
  await load()
}

const columns = [
  { accessorKey: 'sender', header: 'Sender' },
  { accessorKey: 'enabled', header: 'Enabled' },
  { accessorKey: 'dateCreation', header: 'Created' },
]
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Sieve - Rejected senders</h1>
    <UCard>
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <UInput v-model="form.sender" placeholder="@spamdomain.com or full@address.com" />
        <UButton icon="i-lucide-plus" @click="create">Block</UButton>
      </div>
    </UCard>
    <UTable :columns="columns" :data="items" :loading="loading">
      <template #cell-enabled="{ row }">
        <USwitch :model-value="!!row.original.enabled" @update:model-value="toggle(row.original.id, row.original.enabled)" />
      </template>
      <template #actions-cell="{ row }">
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="remove(row.original.id)" />
      </template>
    </UTable>
  </div>
</template>
