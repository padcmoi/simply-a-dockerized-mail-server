<script setup lang="ts">
interface OwnedRecipient {
  id: number;
  email: string;
  domain: string;
  active: boolean;
  quota: string;
}

const props = defineProps<{
  recipients: OwnedRecipient[];
  loading: boolean;
  hasLoadedOnce: boolean;
}>();

const { t } = useI18n();

const source = toRef(props, "recipients");
const { items, total, page, limit, search, sortBy, sortDir } = useClientList(source, ["email", "domain"], "email");

const SORTABLE_COLUMNS = computed(() => [
  { key: "email", label: t("myspace.table.address") },
  { key: "domain", label: t("myspace.table.domain") },
  { key: "active", label: t("myspace.table.status") },
]);

const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

const columns = computed(() => [
  { accessorKey: "email", header: header("email", t("myspace.table.address")) },
  { accessorKey: "domain", header: header("domain", t("myspace.table.domain")) },
  { accessorKey: "active", header: header("active", t("myspace.table.status")) },
  { id: "actions", header: "" },
]);
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <h2 class="font-semibold">{{ t("myspace.ownedRecipients") }}</h2>
      <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ recipients.length }}</UBadge>
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
          <template #email-cell="{ row }">
            <FullTooltip :text="row.original.email">
              <NuxtLink :to="`/my-space/recipients/${row.original.id}`" class="font-medium text-primary hover:underline">
                {{ truncateChars(row.original.email, 44) }}
              </NuxtLink>
            </FullTooltip>
          </template>
          <template #domain-cell="{ row }">
            <FullTooltip :text="row.original.domain"
              ><span class="text-muted">{{ truncateChars(row.original.domain, 30) }}</span></FullTooltip
            >
          </template>
          <template #active-cell="{ row }">
            <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
              {{ row.original.active ? t("common.active") : t("common.inactive") }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UButton
                :to="`/my-space/recipients/${row.original.id}`"
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
        <NuxtLink v-for="r in items" v-else :key="r.id" :to="`/my-space/recipients/${r.id}`" class="block">
          <UCard :ui="{ root: 'transition hover:shadow-md' }">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <FullTooltip :text="r.email">
                  <p class="font-semibold text-primary">{{ truncateChars(r.email, 34) }}</p>
                </FullTooltip>
                <FullTooltip :text="r.domain">
                  <p class="text-xs text-muted">{{ truncateChars(r.domain, 34) }}</p>
                </FullTooltip>
              </div>
              <UBadge :color="r.active ? 'success' : 'neutral'" variant="subtle" size="sm" class="shrink-0">
                {{ r.active ? t("common.active") : t("common.inactive") }}
              </UBadge>
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>
  </section>
</template>
