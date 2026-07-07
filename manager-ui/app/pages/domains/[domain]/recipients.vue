<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "read" },
  ],
});

interface Recipient {
  id: number;
  email: string;
  quota: string;
  active: number;
}

const MIN_QUOTA_BYTES = 1024 * 1024;

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);
const form = reactive({ localPart: "", password: "", quota: 524288000 });

const quotaUnderLimit = computed(() => form.quota < MIN_QUOTA_BYTES);

const columns = computed(() => [
  { accessorKey: "email", header: t("recipients.table.address") },
  { accessorKey: "quota", header: t("recipients.table.quota") },
  { accessorKey: "active", header: t("recipients.table.active") },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: domainFqdn.value, to: `/domains/${domainFqdn.value}` },
    { label: t("nav.recipients") },
  ]);
});

const { items, total, loading, hasLoadedOnce, page, limit, search, sortDir, load } = usePaginatedList<Recipient>(
  "recipients-list",
  () => (domainId.value ? `/domains/${domainId.value}/recipients` : null),
  [domainId]
);

function isPostmaster(item: Recipient) {
  return item.email.toLowerCase().startsWith("postmaster@");
}

async function create() {
  if (!domainId.value) return;
  if (quotaUnderLimit.value) {
    toast.add({ title: t("recipients.toast.quotaTooLow", { value: MIN_QUOTA_BYTES / (1024 * 1024) }), color: "error" });
    return;
  }
  try {
    await call(`/domains/${domainId.value}/recipients`, {
      method: "POST",
      body: {
        localPart: form.localPart,
        password: form.password,
        quota: form.quota,
      },
    });
    form.localPart = "";
    form.password = "";
    await load();
    toast.add({ title: t("recipients.toast.created"), color: "success" });
  } catch (err) {
    toast.add({
      title: t("recipients.toast.createFailed"),
      description: (err as Error).message,
      color: "error",
    });
  }
}

async function remove(row: Recipient) {
  if (!domainId.value) return;
  await call(`/domains/${domainId.value}/recipients/${row.id}`, {
    method: "DELETE",
  });
  await load();
}

function requestDelete(fn: () => Promise<void>) {
  pendingDeleteFn.value = fn;
  confirmOpen.value = true;
}

async function onDeleteConfirmed() {
  await pendingDeleteFn.value?.();
  pendingDeleteFn.value = null;
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('recipients.alertTitle')"
        :description="t('recipients.alertDescription')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="() => load()" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("recipients.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end" @submit="create">
        <UFormField :label="t('recipients.form.localPart')" name="localPart">
          <UInput v-model="form.localPart" placeholder="local-part" class="w-full" />
        </UFormField>
        <UFormField :label="t('recipients.form.password')" name="password">
          <UInput v-model="form.password" type="password" :placeholder="t('recipients.form.password')" class="w-full" />
        </UFormField>
        <UFormField
          :label="t('recipients.form.quotaBytes')"
          name="quota"
          :error="quotaUnderLimit ? t('recipients.form.quotaMin', { value: MIN_QUOTA_BYTES / (1024 * 1024) }) : undefined"
        >
          <UInput v-model.number="form.quota" type="number" :min="MIN_QUOTA_BYTES" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" :disabled="quotaUnderLimit" block class="lg:w-auto">{{
          t("recipients.form.submit")
        }}</UButton>
      </UForm>
    </UCard>

    <ListToolbar v-model:search="search" v-model:limit="limit" v-model:sort-dir="sortDir" :total="total" />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="3" />

    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
        <UTable :columns="columns" :data="items" :loading="loading" sticky>
          <template #email-cell="{ row }">
            <div class="flex items-center gap-2">
              <span>{{ row.original.email }}</span>
              <UBadge v-if="isPostmaster(row.original)" color="neutral" variant="subtle" size="xs" icon="i-lucide-lock">
                {{ t("recipients.postmaster.badge") }}
              </UBadge>
            </div>
          </template>
          <template #active-cell="{ row }">
            <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
              {{ row.original.active ? t("common.yes") : t("common.no") }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <UButton
              v-if="!isPostmaster(row.original)"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              @click="requestDelete(() => remove(row.original))"
            />
            <UTooltip v-else :text="t('recipients.postmaster.locked')">
              <UIcon name="i-lucide-lock" class="text-dimmed" />
            </UTooltip>
          </template>
        </UTable>
      </UCard>

      <div class="lg:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <RecipientCard
          v-for="item in items"
          v-else
          :key="item.id"
          :item="item"
          :is-postmaster="isPostmaster(item)"
          @delete="requestDelete(() => remove(item))"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
