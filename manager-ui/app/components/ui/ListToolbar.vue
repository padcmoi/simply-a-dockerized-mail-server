<script setup lang="ts">
export interface SortableColumnOption {
  key: string;
  label: string;
}

const emit = defineEmits<{
  "update:search": [string];
  "update:limit": [number];
  "update:sortBy": [string];
  "update:sortDir": ["asc" | "desc"];
}>();

const props = withDefaults(
  defineProps<{
    search: string;
    limit: number;
    sortBy: string;
    sortDir: "asc" | "desc";
    sortableColumns?: SortableColumnOption[];
  }>(),
  { sortableColumns: () => [] }
);

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

// Mobile/tablet has no clickable table header (see ListSkeleton's card view),
// so this select is its only way to change sort -- one entry per sortable
// column x direction, combining `sortBy`+`sortDir` into a single value here,
// split back into 2 emits on change. Desktop drives the exact same state via
// each table's own column headers (see useSortableHeader.ts) instead, so
// this select is hidden there (`xl:hidden` below).
const sortOptions = computed(() =>
  props.sortableColumns.flatMap((c) => [
    { label: c.label, value: `${c.key}:asc`, icon: "i-lucide-arrow-up-narrow-wide" },
    { label: c.label, value: `${c.key}:desc`, icon: "i-lucide-arrow-down-wide-narrow" },
  ])
);

const searchModel = computed({
  get: () => props.search,
  set: (v: string) => emit("update:search", v),
});
const limitModel = computed({
  get: () => props.limit,
  set: (v: number) => emit("update:limit", v),
});
const sortModel = computed({
  get: () => `${props.sortBy}:${props.sortDir}`,
  set: (v: string) => {
    const [key, dir] = v.split(":");
    if (!key) return;
    emit("update:sortBy", key);
    emit("update:sortDir", dir === "asc" ? "asc" : "desc");
  },
});

onMounted(() => {
  ready.value = true;
});
</script>

<template>
  <div class="flex items-center justify-between gap-2 flex-wrap">
    <UInput v-model="searchModel" icon="i-lucide-search" :placeholder="t('common.search')" class="w-full sm:w-64" />
    <div class="flex items-center gap-2">
      <USelectMenu v-if="sortOptions.length" v-model="sortModel" value-key="value" :items="sortOptions" class="w-56 xl:hidden" />
      <USkeleton v-if="!ready" class="h-8 w-24 rounded-md" />
      <USelectMenu v-else v-model="limitModel" value-key="value" :items="limitOptions" class="w-24" />
    </div>
  </div>
</template>
