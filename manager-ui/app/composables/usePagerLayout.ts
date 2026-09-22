import { rootFontSizePx } from "./useTableLayout";

const FULL_PAGER_MIN_REM = 32;

export function usePagerLayout(width: MaybeRefOrGetter<number>) {
  const full = computed(() => toValue(width) > 0 && toValue(width) >= FULL_PAGER_MIN_REM * rootFontSizePx());
  const siblingCount = computed(() => (full.value ? 1 : 0));

  return { showEdges: full, siblingCount };
}
