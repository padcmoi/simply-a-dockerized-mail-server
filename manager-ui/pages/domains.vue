<script setup lang="ts">
interface Domain { id: number; domain: string; quota: string; active: number }

const { call } = useApi()
const toast = useToast()
const items = ref<Domain[]>([])
const loading = ref(false)
const form = reactive({ domain: '', active: true })

async function load() {
  loading.value = true
  try { items.value = await call<Domain[]>('/domains') }
  catch (err) { toast.add({ title: 'Failed', description: (err as Error).message, color: 'error' }) }
  finally { loading.value = false }
}
onMounted(load)

async function create() {
  try {
    await call('/domains', { method: 'POST', body: form })
    form.domain = ''
    await load()
    toast.add({ title: 'Domain added', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Add failed', description: (err as Error).message, color: 'error' })
  }
}
async function remove(id: number) {
  await call(`/domains/${id}`, { method: 'DELETE' })
  await load()
}

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'domain', header: 'Domain' },
  { accessorKey: 'active', header: 'Active' },
  { accessorKey: 'quota', header: 'Quota' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Domains</h1>
      <UButton icon="i-lucide-refresh-cw" variant="ghost" :loading="loading" @click="load">Refresh</UButton>
    </div>
    <UCard>
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <UFormField label="New domain">
          <UInput v-model="form.domain" placeholder="example.com" class="w-full" />
        </UFormField>
        <USwitch v-model="form.active" label="Active" />
        <UButton icon="i-lucide-plus" :disabled="!form.domain" @click="create">Add</UButton>
      </div>
    </UCard>
    <UTable :columns="columns" :data="items" :loading="loading">
      <template #cell-active="{ row }">
        <UBadge :color="row.original.active ? 'success' : 'neutral'">
          {{ row.original.active ? 'Yes' : 'No' }}
        </UBadge>
      </template>
      <template #actions-cell="{ row }">
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="remove(row.original.id)" />
      </template>
    </UTable>
  </div>
</template>
