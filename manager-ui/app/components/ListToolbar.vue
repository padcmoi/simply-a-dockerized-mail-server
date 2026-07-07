<script setup lang="ts">
const emit = defineEmits<{
  "update:search": [string];
  "update:limit": [number];
  "update:sortDir": ["asc" | "desc"];
}>();

const props = defineProps<{
  search: string;
  limit: number;
  sortDir: "asc" | "desc";
}>();

const { t } = useI18n();

// `limit` is backed by useLocalStorage (see usePaginatedList.ts) -- its
// real persisted value only lands after mount (SSR always renders the
// default first). Skeleton the select until then instead of flashing the
// default value.
const ready = ref(false);

const limitOptions = [
  { label: "10", value: 10 },
  { label: "25", value: 25 },
  { label: "50", value: 50 },
];

const sortOptions = computed(() => [
  { label: t("common.sortNewestFirst"), value: "desc" as const },
  { label: t("common.sortOldestFirst"), value: "asc" as const },
]);

const searchModel = computed({
  get: () => props.search,
  set: (v: string) => emit("update:search", v),
});
const limitModel = computed({
  get: () => props.limit,
  set: (v: number) => emit("update:limit", v),
});
const sortDirModel = computed({
  get: () => props.sortDir,
  set: (v: "asc" | "desc") => emit("update:sortDir", v),
});

onMounted(() => {
  ready.value = true;
});
</script>

<template>
  <div class="flex items-center justify-between gap-2 flex-wrap">
    <UInput v-model="searchModel" icon="i-lucide-search" :placeholder="t('common.search')" class="w-full sm:w-64" />
    <div class="flex items-center gap-2">
      <USelectMenu v-model="sortDirModel" value-key="value" :items="sortOptions" class="w-44" />
      <USkeleton v-if="!ready" class="h-8 w-24 rounded-md" />
      <USelectMenu v-else v-model="limitModel" value-key="value" :items="limitOptions" class="w-24" />
    </div>
  </div>
</template>
