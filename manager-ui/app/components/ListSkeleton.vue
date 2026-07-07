<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; columns?: number }>(), { rows: 5, columns: 4 });
</script>

<template>
  <div>
    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <div class="divide-y divide-default">
        <div v-for="r in rows" :key="r" class="flex items-center gap-4 px-4 py-3.5">
          <USkeleton v-for="c in columns" :key="c" class="h-4 flex-1" />
        </div>
      </div>
    </UCard>

    <div class="lg:hidden space-y-3">
      <USkeleton v-for="r in rows" :key="r" class="h-20 w-full rounded-lg" />
    </div>
  </div>
</template>
