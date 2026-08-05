<script setup lang="ts">
import { RSPAMD_ACTION_STYLE, type RspamdStats } from "~/composables/useRspamdPage";

const props = defineProps<{
  stats: RspamdStats | null;
  loading: boolean;
}>();

const { t } = useI18n();

// Always shows every counter, including zero -- matching rspamd's own
// webui tile row 1:1 so nothing is hidden (unlike the donut+legend, which
// only surfaces non-zero slices, fine for a proportional chart).
//
// A verdict is written in the colour of its slice, so a tile and the chart
// under it are read as the same thing. The scan and learn totals are not
// verdicts and keep the plain text, which is what makes the colours mean
// something in the first place.
const tiles = computed(() => {
  if (!props.stats) return [];
  const a = props.stats.actions;
  const action = (key: keyof typeof RSPAMD_ACTION_STYLE, value: number) => ({
    key,
    label: key,
    value,
    color: RSPAMD_ACTION_STYLE[key].text,
  });
  return [
    { key: "scanned", label: t("domainDashboard.rspamd.scanned"), value: props.stats.scanned, color: "" },
    action("no action", a["no action"]),
    action("greylist", a.greylist),
    action("add header", a["add header"]),
    action("rewrite subject", a["rewrite subject"]),
    action("reject", a.reject),
    ...(props.stats.learned !== undefined
      ? [{ key: "learned", label: t("domainDashboard.rspamd.learned"), value: props.stats.learned, color: "" }]
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
      <p class="text-2xl font-bold" :class="tile.color">{{ tile.value.toLocaleString() }}</p>
      <p class="text-xs mt-1" :class="tile.color || 'text-muted'">{{ tile.label }}</p>
    </div>
  </div>
</template>
