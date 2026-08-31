<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; columns?: number }>(), { rows: 5, columns: 4 });

// What stands in for a list on its first load has to be the shape of the list that
// lands, and that shape is DataTable's decision: same measurement on this box, same
// threshold, so the skeleton is never a table under what turns out to be blocks.
const root = useTemplateRef<HTMLElement>("root");
const { asTable } = useTableLayout(root);
</script>

<template>
  <div ref="root">
    <UCard v-if="asTable" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <div v-for="r in rows" :key="r" class="flex items-center gap-4 px-4 py-3.5">
          <USkeleton v-for="c in columns" :key="c" class="h-4 flex-1" />
        </div>
      </div>
    </UCard>

    <div v-else class="space-y-3">
      <USkeleton v-for="r in rows" :key="r" class="h-20 w-full rounded-lg" />
    </div>
  </div>
</template>
