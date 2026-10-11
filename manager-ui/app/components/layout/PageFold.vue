<script setup lang="ts">
const props = defineProps<{ filtered?: boolean }>();

const fold = usePageFold();
const headroom = useHeadroom();

watch(
  () => props.filtered === true,
  (value) => {
    fold.filtered.value = value;
  },
  { immediate: true }
);

onMounted(fold.register);
onBeforeUnmount(fold.release);
</script>

<template>
  <div
    :data-open="fold.open.value"
    class="compact:sticky compact:z-35 compact:-mx-4 compact:-mt-4 compact:max-h-[calc(100dvh-var(--ui-header-height))] compact:overflow-y-auto compact:border-b compact:border-default compact:bg-default compact:p-4 compact:shadow-sm compact:data-[open=false]:hidden compact:sm:-mx-6 compact:sm:-mt-6 compact:sm:p-6 compact:xl:-mx-8 compact:xl:-mt-8 compact:xl:p-8"
    :class="headroom ? 'compact:top-0' : 'compact:top-(--ui-header-height)'"
  >
    <slot />
  </div>
</template>
