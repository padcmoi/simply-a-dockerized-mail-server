import { useElementSize, type MaybeComputedElementRef } from "@vueuse/core";

// Table or cards. One question, one boolean, one place that answers it.
//
// Measured on an ELEMENT, not on the window. What decides whether a table fits is the width of the box
// it was handed, and a wide screen says nothing about that: a sidebar, an open devtools pane or a
// two-column layout all leave the viewport wide while giving the list 500px, and a viewport breakpoint
// would keep the table in a box it cannot fit.
//
// 64rem, the same threshold Tailwind spells `@5xl`, resolved against the root font size rather than
// assumed to be 16px, so a reader who enlarged their text gets the cards at the point their columns
// actually stop fitting.
const TABLE_MIN_REM = 64;
const FALLBACK_ROOT_PX = 16;

// Only ever reached once a width has been measured, which is to say in a browser, so there is no
// server-side branch to guard here. The fallback covers the other case: a stylesheet that leaves the
// root font size unreadable would otherwise turn the threshold into NaN and pin the layout to cards.
function rootFontSizePx() {
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : FALLBACK_ROOT_PX;
}

// `asTable` is `null` until the element has been measured, and that third state is the point: there is
// no `ResizeObserver` on the server and no layout before mount, so a plain boolean would have to guess,
// render the wrong half and swap it on hydration. A caller can read the third state as "not yet" and
// start with whichever rendering is cheaper to be wrong about.
export function useTableLayout(target: MaybeComputedElementRef) {
  const { width } = useElementSize(target);

  const measured = computed(() => width.value > 0);
  const asTable = computed(() => (measured.value ? width.value >= TABLE_MIN_REM * rootFontSizePx() : null));

  return { asTable, measured, width };
}
