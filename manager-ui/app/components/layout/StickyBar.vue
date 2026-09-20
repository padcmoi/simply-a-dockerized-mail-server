<script setup lang="ts">
// A line of a page that stays on screen while what it describes scrolls under
// it. One box and no wrapper around it: a sticky element only travels inside
// its parent, and an enclosure cut to its own height would let it scroll away
// with the page.
//
// Where it is pinned follows the top bar, `top-0` while the bar is away and
// under it while it is there, so the two never claim the same strip of the
// window. Whether it is pinned is the line's own offset read back from the
// stylesheet against where it is drawn: a sticky line sits lower than its
// offset until it is caught, and exactly on it afterwards. Nothing here writes
// the height of the bar, which is the point: that height changes, and a copy of
// it would go stale.
//
// The slot is told, so a line too tall to ride the window can answer with a
// shorter shape. What is below it then moves up by what it gave back, which is
// the space it was taking for nothing.
//
// Pinned, it wears the tint of the side rail, which is a quarter of
// `bg-elevated`. The rail can let the page through at that strength, a bar with
// a chart running under it cannot: the tint is laid on an opaque ground instead,
// as a layer of its own, so the colour is the rail's and nothing shows through.
const line = useTemplateRef<HTMLElement>("line");

const headroom = useHeadroom();
const { y } = useWindowScroll();

const stuck = shallowRef(false);

watch([y, headroom], measure);
useResizeObserver(line, measure);

function measure() {
  const element = line.value;
  if (!element) return;
  const offset = Number.parseFloat(getComputedStyle(element).top) || 0;
  stuck.value = element.getBoundingClientRect().top <= offset + 1;
}

onMounted(measure);
</script>

<template>
  <div
    ref="line"
    class="sticky z-30 -mx-4 px-4 transition-colors sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8"
    :class="[
      headroom ? 'top-0' : 'top-(--ui-header-height)',
      stuck &&
        'border-b border-default bg-default py-2 shadow-sm before:absolute before:inset-0 before:-z-10 before:bg-elevated/25 before:content-[\'\']',
    ]"
  >
    <slot :stuck="stuck" />
  </div>
</template>
