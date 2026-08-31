<script setup lang="ts">
// The graduation, under the moments it marks. Absolutely placed rather than
// spaced by a flexbox: a time has to sit where it is, not where an even
// distribution would put it.
defineProps<{
  marks: { at: number; label: string }[];
  /** How the marks travel with the curve. Empty on a chart that stands still. */
  walk?: Record<string, string>;
}>();
</script>

<template>
  <!-- The same negative margins as the plot, so a mark and the moment of the
       curve it names are measured against the same width. Anything else puts
       every graduation a card's padding away from what it marks. -->
  <div class="relative -mx-4 h-3 overflow-hidden text-[10px] leading-none text-dimmed sm:-mx-6">
    <!-- Every graduation names a moment of the curve, so they all walk with it:
         nothing is pinned to an end of the box. -->
    <span class="absolute inset-0" :style="walk">
      <span v-for="(mark, index) in marks" :key="index" class="absolute -translate-x-1/2" :style="{ left: `${mark.at}%` }">{{
        mark.label
      }}</span>
    </span>
  </div>
</template>
