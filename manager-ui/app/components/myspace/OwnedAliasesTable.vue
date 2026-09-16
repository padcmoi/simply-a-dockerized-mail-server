<script setup lang="ts">
const { aliases } = defineProps<{
  aliases: OwnedAlias[];
  loading: boolean;
  hasLoadedOnce: boolean;
}>();

const { t } = useI18n();
const { formatDateTime } = useDateTime();

const columns = computed<DataTableColumn<OwnedAlias>[]>(() => [
  { key: "createdAt", label: t("common.creationDate"), value: (row) => row.createdAt ?? "" },
  { key: "source", label: t("myspace.table.address"), value: (row) => row.source, primary: true },
  { key: "destination", label: t("myspace.table.destination"), value: (row) => row.destination },
  { key: "domain", label: t("myspace.table.domain"), value: (row) => row.domain },
  {
    key: "validity",
    label: t("myspace.table.validity"),
    value: (row) => isWindowOpenToday(row.userStartDate, row.userEndDate),
  },
]);
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <h2 class="font-semibold">{{ t("myspace.ownedAliases") }}</h2>
      <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ aliases.length }}</UBadge>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="5" />

    <DataTable
      v-else
      :data="aliases"
      :columns="columns"
      :loading="loading"
      :row-key="(row: OwnedAlias) => row.id"
      sort-key="createdAt"
      sort-direction="desc"
      :empty-label="t('common.noResults')"
    >
      <template #createdAt="{ row }">
        <span class="text-muted whitespace-nowrap">{{ formatDateTime(row.createdAt) }}</span>
      </template>

      <template #source="{ row }">
        <FullTooltip :text="row.source">
          <NuxtLink :to="`/my-space/aliases/${row.id}`" class="font-medium text-primary hover:underline">
            {{ truncateChars(row.source, 44) }}
          </NuxtLink>
        </FullTooltip>
      </template>

      <template #destination="{ row }">
        <FullTooltip :text="row.destination">
          <span class="text-muted">
            <UIcon name="i-lucide-arrow-right" class="inline size-3 align-middle" />
            {{ truncateChars(row.destination, 44) }}
          </span>
        </FullTooltip>
      </template>

      <template #domain="{ row }">
        <FullTooltip :text="row.domain">
          <span class="text-muted">{{ truncateChars(row.domain, 30) }}</span>
        </FullTooltip>
      </template>

      <template #validity="{ row }">
        <ValidityWindowCell :start="row.userStartDate" :end="row.userEndDate" />
      </template>
    </DataTable>
  </section>
</template>
