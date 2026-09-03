<script setup lang="ts">
const props = defineProps<{
  disk: { totalBytes: number; freeBytes: number; reservedBytes: number; assignableBytes: number } | null;
}>();

const total = computed(() => formatBytes(props.disk?.totalBytes ?? 0));
const free = computed(() => formatBytes(props.disk?.freeBytes ?? 0));
const reserved = computed(() => formatBytes(props.disk?.reservedBytes ?? 0));
const assignable = computed(() => formatBytes(props.disk?.assignableBytes ?? 0));
// The 4 numbers above already say this, but nothing there is a glanceable
// visual, unlike the per-domain dashboard's own donut.
const reservedPercent = computed(() =>
  props.disk && props.disk.totalBytes > 0 ? (props.disk.reservedBytes / props.disk.totalBytes) * 100 : 0
);
const reservedColor = computed(() => {
  if (reservedPercent.value > 90) return "error";
  if (reservedPercent.value > 70) return "warning";
  return "success";
});

const { t } = useI18n();
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t("domains.capacity.title") }}</h2>
        <span class="text-sm text-dimmed">{{ t("domains.capacity.hint") }}</span>
      </div>
    </template>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <div>
        <p class="text-dimmed">{{ t("domains.capacity.total") }}</p>
        <p class="font-semibold">{{ total }}</p>
      </div>
      <div>
        <p class="text-dimmed">{{ t("domains.capacity.free") }}</p>
        <p class="font-semibold">{{ free }}</p>
      </div>
      <div>
        <p class="text-dimmed">{{ t("domains.capacity.reserved") }}</p>
        <p class="font-semibold">{{ reserved }}</p>
      </div>
      <div>
        <p class="text-dimmed">{{ t("domains.capacity.assignable") }}</p>
        <p class="font-semibold text-primary">{{ assignable }}</p>
      </div>
    </div>
    <div class="mt-4">
      <div class="flex items-center justify-between text-xs text-dimmed mb-1">
        <span>{{ t("domains.capacity.occupancy") }}</span>
        <span class="font-medium">{{ reservedPercent.toFixed(1) }}%</span>
      </div>
      <UProgress :model-value="reservedPercent" :color="reservedColor" />
    </div>
  </UCard>
</template>
