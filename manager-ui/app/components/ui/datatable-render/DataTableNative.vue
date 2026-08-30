<script setup lang="ts" generic="T">
import type { TableColumn } from "@nuxt/ui";

const emit = defineEmits<{ toggleSort: [key: string] }>();

// One cell slot per column key, plus `actions`, forwarded whole by the wrapper.
defineSlots<Record<string, (_props: { row: T }) => unknown>>();

const props = defineProps<{
  rows: T[];
  columns: DataTableColumn<T>[];
  loading: boolean;
  sort: { key: string; direction: "asc" | "desc" } | null;
  rowClass?: (_row: T) => string;
  emptyLabel?: string;
}>();

const { t } = useI18n();

const slots = useSlots();

// UTable states a row's class through its meta rather than on the element, the
// row being rendered by the component itself.
const meta = computed(() => ({ class: { tr: (row: { original: T }) => props.rowClass?.(row.original) ?? "" } }));

// Display columns rather than accessors: every cell goes through the caller's own slot below, so
// letting the table read the row a second time would be a second definition of what the column shows.
const tableColumns = computed<TableColumn<T>[]>(() => {
  const declared = props.columns.map((column) => ({ id: column.key, header: column.label }));
  return slots.actions ? [...declared, { id: "actions" }] : declared;
});

function headerSlot(key: string) {
  return `${key}-header`;
}

function cellSlot(key: string) {
  return `${key}-cell`;
}

function sortIcon(key: string) {
  if (props.sort?.key !== key) return "i-lucide-chevrons-up-down";
  return props.sort.direction === "asc" ? "i-lucide-arrow-up-narrow-wide" : "i-lucide-arrow-down-wide-narrow";
}
</script>

<template>
  <UTable :data="rows" :columns="tableColumns" :loading="loading" :meta="meta" class="min-w-0">
    <template v-for="column in columns" :key="`header-${column.key}`" #[headerSlot(column.key)]>
      <UButton
        v-if="column.sortable !== false"
        type="button"
        color="neutral"
        variant="link"
        size="xs"
        :label="column.label"
        :trailing-icon="sortIcon(column.key)"
        :class="{ 'text-highlighted': sort?.key === column.key }"
        :ui="{ base: '-mx-1 gap-1 px-1 py-0.5 font-normal hover:text-highlighted', trailingIcon: 'size-3.5 opacity-70' }"
        @click="emit('toggleSort', column.key)"
      />
      <span v-else>{{ column.label }}</span>
    </template>

    <template v-for="column in columns" :key="`cell-${column.key}`" #[cellSlot(column.key)]="{ row }">
      <div :class="column.class ?? 'min-w-0 truncate'">
        <slot :name="column.key" :row="row.original">{{ dataTableText(column, row.original) }}</slot>
      </div>
    </template>

    <template v-if="$slots.actions" #actions-cell="{ row }">
      <div class="flex justify-end gap-1">
        <slot name="actions" :row="row.original" />
      </div>
    </template>

    <template #empty>
      <p class="py-6 text-center text-sm text-muted">{{ emptyLabel ?? t("table.empty") }}</p>
    </template>
  </UTable>
</template>
