<script setup lang="ts">
const { y } = useWindowScroll();
const { height } = useWindowSize();

const progress = shallowRef(0);

watch(
  [y, height],
  () => {
    const range = document.documentElement.scrollHeight - height.value;
    progress.value = range > 0 ? Math.min(100, Math.max(0, (y.value / range) * 100)) : 0;
  },
  { flush: "post" }
);
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
    <div class="h-full bg-primary transition-[width] duration-100 ease-out" :style="{ width: `${progress}%` }" />
  </div>
</template>
