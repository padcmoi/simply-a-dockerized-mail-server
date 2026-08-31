<script setup lang="ts" generic="T">
defineSlots<Record<string, (_props: { row: T }) => unknown>>();

const props = defineProps<{
  rows: T[];
  columns: DataTableColumn<T>[];
  loading: boolean;
  // Stable identity for the list's `:key`. Without one the index stands in, which is enough for rows
  // that carry no state of their own.
  rowKey?: (_row: T) => string | number;
  rowClass?: (_row: T) => string;
  emptyLabel?: string;
}>();

const { t } = useI18n();

// What the table puts in a header row, a block puts in a heading. `hideOnCard` is the escape hatch for
// a column that only means something beside the others.
const cardColumns = computed(() => props.columns.filter((column) => !column.primary && !column.hideOnCard));
const primaryColumn = computed(() => props.columns.find((column) => column.primary) ?? props.columns[0]);

function keyOf(row: T, index: number) {
  return props.rowKey ? props.rowKey(row) : index;
}
</script>

<template>
  <div class="relative" :class="{ 'loading-ring': loading }">
    <span v-if="loading" role="status" class="sr-only">{{ t("table.loading") }}</span>

    <div class="space-y-3">
      <p v-if="!loading && rows.length === 0" class="py-6 text-center text-sm text-muted">
        {{ emptyLabel ?? t("table.empty") }}
      </p>

      <div
        v-for="(row, index) in rows"
        :key="keyOf(row, index)"
        class="rounded-lg border border-default bg-elevated/40 p-4"
        :class="rowClass?.(row)"
      >
        <div class="flex items-start justify-between gap-3">
          <div v-if="primaryColumn" class="min-w-0 font-medium">
            <slot :name="primaryColumn.key" :row="row">{{ dataTableText(primaryColumn, row) }}</slot>
          </div>
          <div v-if="$slots.actions" class="flex shrink-0 gap-1">
            <slot name="actions" :row="row" />
          </div>
        </div>

        <dl v-if="cardColumns.length" class="mt-3 grid grid-cols-[minmax(0,8rem)_1fr] gap-x-3 gap-y-2">
          <template v-for="column in cardColumns" :key="`card-${column.key}`">
            <dt class="truncate text-xs tracking-wide text-muted uppercase">{{ column.label }}</dt>
            <dd class="min-w-0 text-sm">
              <slot :name="column.key" :row="row">{{ dataTableText(column, row) }}</slot>
            </dd>
          </template>
        </dl>
      </div>
    </div>
  </div>
</template>
