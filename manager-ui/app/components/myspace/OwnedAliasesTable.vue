<script setup lang="ts">
interface OwnedAlias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}

const props = defineProps<{
  aliases: OwnedAlias[];
  loading: boolean;
  hasLoadedOnce: boolean;
}>();

const { t } = useI18n();

const source = toRef(props, "aliases");
const { items, total, page, limit, search, sortBy, sortDir } = useClientList(
  source,
  ["source", "destination", "domain"],
  "source"
);

const SORTABLE_COLUMNS = computed(() => [
  { key: "source", label: t("myspace.table.address") },
  { key: "destination", label: t("myspace.table.destination") },
  { key: "domain", label: t("myspace.table.domain") },
]);

const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

const columns = computed(() => [
  { accessorKey: "source", header: header("source", t("myspace.table.address")) },
  { accessorKey: "destination", header: header("destination", t("myspace.table.destination")) },
  { accessorKey: "domain", header: header("domain", t("myspace.table.domain")) },
  { id: "actions", header: "" },
]);
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <h2 class="font-semibold">{{ t("myspace.ownedAliases") }}</h2>
      <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ aliases.length }}</UBadge>
    </div>

    <ListToolbar
      v-model:search="search"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      :total="total"
      :sortable-columns="SORTABLE_COLUMNS"
    />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="3" />

    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden xl:block">
        <UTable :columns="columns" :data="items" :loading="loading" sticky>
          <template #source-cell="{ row }">
            <FullTooltip :text="row.original.source">
              <NuxtLink :to="`/my-space/aliases/${row.original.id}`" class="font-medium text-primary hover:underline">
                {{ truncateChars(row.original.source, 44) }}
              </NuxtLink>
            </FullTooltip>
          </template>
          <template #destination-cell="{ row }">
            <FullTooltip :text="row.original.destination">
              <span class="text-muted">{{ truncateChars(row.original.destination, 44) }}</span>
            </FullTooltip>
          </template>
          <template #domain-cell="{ row }">
            <FullTooltip :text="row.original.domain"
              ><span class="text-muted">{{ truncateChars(row.original.domain, 30) }}</span></FullTooltip
            >
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UButton
                :to="`/my-space/aliases/${row.original.id}`"
                :aria-label="t('myspace.manage')"
                icon="i-lucide-arrow-right"
                color="neutral"
                variant="ghost"
                size="xs"
                square
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <NuxtLink v-for="a in items" v-else :key="a.id" :to="`/my-space/aliases/${a.id}`" class="block">
          <UCard :ui="{ root: 'transition hover:shadow-md' }">
            <div class="min-w-0 space-y-1">
              <FullTooltip :text="a.source">
                <p class="font-semibold text-primary">{{ truncateChars(a.source, 34) }}</p>
              </FullTooltip>
              <FullTooltip :text="a.destination">
                <p class="text-xs text-muted">
                  <UIcon name="i-lucide-arrow-right" class="inline size-3 align-middle" />
                  {{ truncateChars(a.destination, 32) }}
                </p>
              </FullTooltip>
              <FullTooltip :text="a.domain">
                <p class="text-xs text-muted">{{ truncateChars(a.domain, 34) }}</p>
              </FullTooltip>
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>
  </section>
</template>
