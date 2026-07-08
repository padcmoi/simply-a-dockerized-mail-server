<script setup lang="ts">
const emit = defineEmits<{ "update:page": [number] }>();

const props = defineProps<{
  page: number;
  total: number;
  limit: number;
}>();

const { t } = useI18n();

const pageModel = computed({
  get: () => props.page,
  set: (v: number) => emit("update:page", v),
});
</script>

<template>
  <div class="flex items-center justify-center sm:justify-between gap-2 flex-wrap">
    <UPagination v-model:page="pageModel" :total="total" :items-per-page="limit" size="xl" />
    <p class="text-sm text-muted whitespace-nowrap">{{ t("common.totalCount", { count: total }) }}</p>
  </div>
</template>
