<script setup lang="ts">
const emit = defineEmits<{ "update:page": [number] }>();

const props = defineProps<{
  page: number;
  total: number;
  limit: number;
}>();

const { t } = useI18n();

const root = useTemplateRef<HTMLElement>("root");
const { width } = useElementSize(root);
const { showEdges, siblingCount } = usePagerLayout(width);

const pageModel = computed({
  get: () => props.page,
  set: (v: number) => emit("update:page", v),
});
</script>

<template>
  <div ref="root" class="flex items-center justify-center sm:justify-between gap-2 flex-wrap">
    <UPagination
      v-model:page="pageModel"
      :total="total"
      :items-per-page="limit"
      :sibling-count="siblingCount"
      :show-edges="showEdges"
      size="xl"
    />
    <p class="text-sm text-muted whitespace-nowrap">{{ t("common.totalCount", { count: total }) }}</p>
  </div>
</template>
