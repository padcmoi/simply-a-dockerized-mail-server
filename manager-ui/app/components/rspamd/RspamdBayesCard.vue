<script setup lang="ts">
import type { RspamdBayesStatfile } from "~/composables/useRspamdPage";

defineProps<{
  statfiles: RspamdBayesStatfile[];
  loading: boolean;
}>();

const { t } = useI18n();

const columns = computed(() => [
  { accessorKey: "symbol", header: t("rspamdPage.bayes.symbol") },
  { accessorKey: "type", header: t("rspamdPage.bayes.type") },
  { accessorKey: "revision", header: t("rspamdPage.bayes.learns") },
  { accessorKey: "users", header: t("rspamdPage.bayes.users") },
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
    <p v-else-if="statfiles.length === 0" class="text-sm text-muted text-center py-4">
      {{ t("rspamdPage.bayes.noData") }}
    </p>
    <UTable v-else :columns="columns" :data="statfiles" :loading="loading">
      <template #symbol-cell="{ row }">
        <UBadge :color="symbolColor(row.original.symbol)" variant="subtle" :icon="symbolIcon(row.original.symbol)">
          {{ row.original.symbol }}
        </UBadge>
      </template>
      <template #type-cell="{ row }">
        <UBadge color="neutral" variant="subtle" class="font-mono text-xs">{{ row.original.type }}</UBadge>
      </template>
      <template #revision-cell="{ row }">
        <span class="font-semibold">{{ row.original.revision.toLocaleString() }}</span>
      </template>
      <template #users-cell="{ row }">
        <div class="flex items-center gap-1.5 text-muted">
          <UIcon name="i-lucide-users" />
          {{ row.original.users.toLocaleString() }}
        </div>
      </template>
    </UTable>
  </UCard>
</template>
