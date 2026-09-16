<script setup lang="ts">
const { recipients } = defineProps<{
  recipients: OwnedRecipient[];
  loading: boolean;
  hasLoadedOnce: boolean;
}>();

const { t } = useI18n();
const { formatDateTime } = useDateTime();

// Searching, sorting and paging belong to DataTable, which also decides whether
// these rows are a table or a block each, and puts only one of the two in the
// page. Written here they were both at once, the table hidden under `xl` and the
// cards hidden above it: every reader carried the list twice, and the phone,
// which only ever sees the blocks, paid for the table it will never be shown.
const columns = computed<DataTableColumn<OwnedRecipient>[]>(() => [
  { key: "createdAt", label: t("common.creationDate"), value: (row) => row.createdAt ?? "" },
  { key: "email", label: t("myspace.table.address"), value: (row) => row.email, primary: true },
  { key: "domain", label: t("myspace.table.domain"), value: (row) => row.domain },
  { key: "quota", label: t("myspace.table.quota"), value: (row) => Number(row.usedBytes) },
  { key: "active", label: t("myspace.table.status"), value: (row) => row.active },
  {
    key: "validity",
    label: t("myspace.table.validity"),
    value: (row) => isWindowOpenToday(row.userStartDate, row.userEndDate),
  },
]);

function occupancy(r: OwnedRecipient) {
  return occupancyPercent(Number(r.quota), Number(r.usedBytes));
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <h2 class="font-semibold">{{ t("myspace.ownedRecipients") }}</h2>
      <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ recipients.length }}</UBadge>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="6" />

    <DataTable
      v-else
      :data="recipients"
      :columns="columns"
      :loading="loading"
      :row-key="(row: OwnedRecipient) => row.id"
      sort-key="createdAt"
      sort-direction="desc"
      :empty-label="t('common.noResults')"
    >
      <template #createdAt="{ row }">
        <span class="text-muted whitespace-nowrap">{{ formatDateTime(row.createdAt) }}</span>
      </template>

      <template #email="{ row }">
        <FullTooltip :text="row.email">
          <NuxtLink :to="`/my-space/recipients/${row.id}`" class="font-medium text-primary hover:underline">
            {{ truncateChars(row.email, 44) }}
          </NuxtLink>
        </FullTooltip>
      </template>

      <template #domain="{ row }">
        <FullTooltip :text="row.domain">
          <span class="text-muted">{{ truncateChars(row.domain, 30) }}</span>
        </FullTooltip>
      </template>

      <template #quota="{ row }">
        <div class="min-w-[130px]">
          <p>{{ formatBytes(Number(row.usedBytes)) }} / {{ formatBytes(Number(row.quota)) }}</p>
          <UProgress :model-value="occupancy(row)" :color="occupancyColor(occupancy(row))" size="xs" class="mt-1" />
        </div>
      </template>

      <template #active="{ row }">
        <UBadge :color="row.active ? 'success' : 'neutral'" variant="subtle">
          {{ row.active ? t("common.active") : t("common.inactive") }}
        </UBadge>
      </template>

      <template #validity="{ row }">
        <ValidityWindowCell :start="row.userStartDate" :end="row.userEndDate" />
      </template>
    </DataTable>
  </section>
</template>
