export function usePageFold() {
  const open = useState("page-fold-open", () => false);
  const folds = useState("page-fold-count", () => 0);
  const filtered = useState("page-fold-filtered", () => false);

  const available = computed(() => folds.value > 0);
  const flagged = computed(() => filtered.value && !open.value);

  function toggle() {
    open.value = !open.value;
  }

  function close() {
    open.value = false;
  }

  function register() {
    folds.value += 1;
  }

  function release() {
    folds.value = Math.max(0, folds.value - 1);
    if (folds.value > 0) return;
    open.value = false;
    filtered.value = false;
  }

  return { open, filtered, available, flagged, toggle, close, register, release };
}
