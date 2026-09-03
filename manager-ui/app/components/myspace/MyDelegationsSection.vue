<script setup lang="ts">
const { t } = useI18n();
const { rows, loading, hasLoadedOnce } = useMyDelegations();

const columns = computed<DataTableColumn<MyDelegation>[]>(() => [
  { key: "domain", label: t("myspace.delegations.domain"), value: (row) => row.domain, primary: true },
  { key: "mailboxes", label: t("myspace.delegations.mailboxes"), value: (row) => row.usedRecipients },
  { key: "aliases", label: t("myspace.delegations.aliases"), value: (row) => row.usedAliases },
  { key: "quota", label: t("myspace.delegations.quota"), value: (row) => Number(row.usedBytes) },
]);

function capText(used: number, max: number | null) {
  return max === null ? t("myspace.delegations.unlimited", { used }) : t("myspace.delegations.used", { used, max });
}

function recipientCapReached(row: MyDelegation) {
  return row.maxRecipients !== null && row.usedRecipients >= row.maxRecipients;
}

function aliasCapReached(row: MyDelegation) {
  return row.maxAliases !== null && row.usedAliases >= row.maxAliases;
}
</script>

<template>
  <section class="space-y-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold">{{ t("myspace.delegations.title") }}</h2>
        <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ rows.length }}</UBadge>
      </div>
      <p class="text-xs text-muted">{{ t("myspace.delegations.subtitle") }}</p>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />

    <DataTable
      v-else
      :data="rows"
      :columns="columns"
      :loading="loading"
      :row-key="(row: MyDelegation) => row.domainId"
      sort-key="domain"
      :empty-label="t('myspace.delegations.empty')"
    >
      <template #domain="{ row }">
        <FullTooltip :text="row.domain">
          <span class="font-medium">{{ truncateChars(row.domain, 40) }}</span>
        </FullTooltip>
      </template>

      <template #mailboxes="{ row }">{{ capText(row.usedRecipients, row.maxRecipients) }}</template>
      <template #aliases="{ row }">{{ capText(row.usedAliases, row.maxAliases) }}</template>
      <template #quota="{ row }">
        {{ t("myspace.delegations.usedQuota", { used: Math.round(Number(row.usedBytes) / MB), total: row.quotaMb }) }}
      </template>

      <template #actions="{ row }">
        <div class="flex justify-end gap-2 flex-wrap">
          <UButton
            icon="i-lucide-plus"
            size="xs"
            :disabled="recipientCapReached(row)"
            :to="`/my-space/domains/${row.domainId}/recipients/create`"
          >
            {{ t("myspace.delegations.newRecipient") }}
          </UButton>
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="soft"
            size="xs"
            :disabled="aliasCapReached(row)"
            :to="`/my-space/domains/${row.domainId}/aliases/create`"
          >
            {{ t("myspace.delegations.newAlias") }}
          </UButton>
        </div>
      </template>
    </DataTable>

    <p v-if="hasLoadedOnce && rows.length > 0" class="text-xs text-muted">{{ t("myspace.delegations.manageHint") }}</p>
  </section>
</template>
