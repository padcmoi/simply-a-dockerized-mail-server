<script setup lang="ts">
const props = defineProps<{ start: string | null | undefined; end: string | null | undefined }>();

const { t } = useI18n();
const { formatDate } = useDateTime();

const from = computed(() => windowStartDay(props.start));
const until = computed(() => windowEndDay(props.end));
const open = computed(() => isWindowOpenToday(props.start, props.end));
</script>

<template>
  <span class="inline-flex items-center gap-1.5 whitespace-nowrap" :class="open ? 'text-success' : 'text-error'">
    <template v-if="!from && !until">{{ t("common.dateRange.unlimited") }}</template>
    <template v-else>
      <span>{{ from ? formatDate(from) : t("common.dateRange.unlimited") }}</span>
      <UIcon name="i-lucide-arrow-right" class="size-3.5 shrink-0" />
      <span>{{ until ? formatDate(until) : t("common.dateRange.unlimited") }}</span>
    </template>
  </span>
</template>
