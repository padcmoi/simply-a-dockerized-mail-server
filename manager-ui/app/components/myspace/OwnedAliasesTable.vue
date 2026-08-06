<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";

interface OwnedAlias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}

const { aliases } = defineProps<{
  aliases: OwnedAlias[];
  loading: boolean;
  hasLoadedOnce: boolean;
}>();

const { t } = useI18n();

const columns = computed<DataTableColumn<OwnedAlias>[]>(() => [
  { key: "source", label: t("myspace.table.address"), value: (row) => row.source, primary: true },
  { key: "destination", label: t("myspace.table.destination"), value: (row) => row.destination },
  { key: "domain", label: t("myspace.table.domain"), value: (row) => row.domain },
]);
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <h2 class="font-semibold">{{ t("myspace.ownedAliases") }}</h2>
      <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ aliases.length }}</UBadge>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="3" />

    <DataTable
      v-else
      :data="aliases"
      :columns="columns"
      :loading="loading"
      :row-key="(row: OwnedAlias) => row.id"
      sort-key="source"
      :empty-label="t('common.noResults')"
    >
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

      <template #actions="{ row }">
        <UButton
          :to="`/my-space/aliases/${row.id}`"
          :aria-label="t('myspace.manage')"
          icon="i-lucide-arrow-right"
          color="neutral"
          variant="ghost"
          size="xs"
          square
        />
      </template>
    </DataTable>
  </section>
</template>
