<script setup lang="ts">
import type { RspamdStats } from "~/composables/useRspamdPage";

const props = defineProps<{
  stats: RspamdStats | null;
  loading: boolean;
}>();

const { t } = useI18n();

// Always shows every counter, including zero -- matching rspamd's own
// webui tile row 1:1 so nothing is hidden (unlike the donut+legend, which
// only surfaces non-zero slices, fine for a proportional chart).
const tiles = computed(() => {
  if (!props.stats) return [];
  const a = props.stats.actions;
  return [
    { key: "scanned", label: t("domainDashboard.rspamd.scanned"), value: props.stats.scanned },
    { key: "no action", label: "no action", value: a["no action"] },
    { key: "greylist", label: "greylist", value: a.greylist },
    { key: "add header", label: "add header", value: a["add header"] },
    { key: "rewrite subject", label: "rewrite subject", value: a["rewrite subject"] },
    { key: "reject", label: "reject", value: a.reject },
    ...(props.stats.learned !== undefined
      ? [{ key: "learned", label: t("domainDashboard.rspamd.learned"), value: props.stats.learned }]
      : []),
  ];
});
</script>

<template>
  <div v-if="loading && !stats" class="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
    <USkeleton v-for="i in 7" :key="i" class="h-16 w-full rounded-lg" />
  </div>
  <div v-else-if="stats" class="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
    <div v-for="tile in tiles" :key="tile.key" class="bg-elevated rounded-lg p-3 text-center">
      <p class="text-2xl font-bold">{{ tile.value.toLocaleString() }}</p>
      <p class="text-xs text-muted mt-1">{{ tile.label }}</p>
    </div>
  </div>
</template>
