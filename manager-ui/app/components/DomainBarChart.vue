<script setup lang="ts">
const props = defineProps<{
  items: { domain: string; count: number }[];
}>();

const BAR_HEIGHT = 24;
const GAP = 8;
const LABEL_W = 140;
const CHART_W = 180;
const PADDING = 8;

const maxCount = computed(() => Math.max(...props.items.map((i) => i.count), 1));

const svgHeight = computed(() => props.items.length * (BAR_HEIGHT + GAP) - GAP + PADDING * 2);

const { t } = useI18n();

function barWidth(count: number) {
  return (count / maxCount.value) * CHART_W;
}

function yPos(index: number) {
  return PADDING + index * (BAR_HEIGHT + GAP);
}
</script>

<template>
  <div v-if="items.length === 0" class="text-sm text-muted text-center py-4">
    {{ t("dashboard.recent.noDomains") }}
  </div>
  <div v-else class="overflow-x-auto">
    <svg :width="LABEL_W + CHART_W + 40" :height="svgHeight" class="block">
      <g v-for="(item, i) in items" :key="item.domain">
        <text :x="LABEL_W - 6" :y="yPos(i) + BAR_HEIGHT / 2 + 4" text-anchor="end" class="fill-muted text-[11px]" font-size="11">
          {{ item.domain.length > 18 ? item.domain.slice(0, 16) + "..." : item.domain }}
        </text>
        <rect :x="LABEL_W" :y="yPos(i)" :width="barWidth(item.count)" :height="BAR_HEIGHT" rx="4" class="fill-primary/70" />
        <text
          :x="LABEL_W + barWidth(item.count) + 6"
          :y="yPos(i) + BAR_HEIGHT / 2 + 4"
          font-size="11"
          class="fill-muted text-[11px]"
        >
          {{ item.count }}
        </text>
      </g>
    </svg>
    <p class="text-xs text-dimmed mt-1">{{ t("dashboard.chart.recipients") }}</p>
  </div>
</template>
