<script setup lang="ts">
defineProps<{
  statfiles: RspamdBayesStatfile[];
  loading: boolean;
}>();

const { t } = useI18n();

const columns = computed<DataTableColumn<RspamdBayesStatfile>[]>(() => [
  { key: "symbol", label: t("rspamdPage.bayes.symbol"), value: (row) => row.symbol, primary: true },
  { key: "type", label: t("rspamdPage.bayes.type"), value: (row) => row.type },
  { key: "revision", label: t("rspamdPage.bayes.learns"), value: (row) => row.revision },
  { key: "users", label: t("rspamdPage.bayes.users"), value: (row) => row.users },
]);

function symbolColor(symbol: string) {
  if (symbol.includes("SPAM")) return "error";
  if (symbol.includes("HAM")) return "success";
  return "neutral";
}

function symbolIcon(symbol: string) {
  if (symbol.includes("SPAM")) return "i-lucide-thumbs-down";
  if (symbol.includes("HAM")) return "i-lucide-thumbs-up";
  return "i-lucide-database";
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("rspamdPage.bayes.title") }}</h2>
    </template>

    <div v-if="loading && statfiles.length === 0" class="space-y-2">
      <USkeleton v-for="i in 2" :key="i" class="h-10 w-full" />
    </div>

    <DataTable
      v-else
      :data="statfiles"
      :columns="columns"
      :loading="loading"
      :row-key="(row: RspamdBayesStatfile) => row.symbol"
      :with-search="false"
      :with-pagination="false"
      :empty-label="t('rspamdPage.bayes.noData')"
    >
      <template #symbol="{ row }">
        <UBadge :color="symbolColor(row.symbol)" variant="subtle" :icon="symbolIcon(row.symbol)">
          {{ row.symbol }}
        </UBadge>
      </template>

      <template #type="{ row }">
        <UBadge color="neutral" variant="subtle" class="font-mono text-xs">{{ row.type }}</UBadge>
      </template>

      <template #revision="{ row }">
        <span class="font-semibold">{{ row.revision.toLocaleString() }}</span>
      </template>

      <template #users="{ row }">
        <div class="flex items-center gap-1.5 text-muted">
          <UIcon name="i-lucide-users" />
          {{ row.users.toLocaleString() }}
        </div>
      </template>
    </DataTable>
  </UCard>
</template>
