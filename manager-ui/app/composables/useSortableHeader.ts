import { h, type resolveComponent } from "vue";

// Renders clickable column headers (label + direction arrow, Nuxt UI's own
// documented "With column sorting" UTable pattern) driving `sortBy`/`sortDir`
// server-side -- not TanStack's own client-side column sorting state, since
// there's nothing to sort client-side (the fetch itself re-orders on the
// server). Every column a table wants sortable calls `header(key, label)`;
// non-sortable columns (actions, computed/enriched fields with no real DB
// column to order by) keep a plain string header.
//
// `UButton` is passed in, not resolved here: Nuxt's component auto-import
// only scans actual .vue SFCs for `resolveComponent(...)` calls to know what
// to register -- calling it from this plain .ts file left UButton
// unresolved at runtime ("Failed to resolve component: UButton"). Each page
// resolves it locally (matching the docs example exactly) and passes it in.
export function useSortableColumns(
  sortBy: Ref<string>,
  sortDir: Ref<"asc" | "desc">,
  UButton: ReturnType<typeof resolveComponent>
) {
  function toggle(key: string) {
    if (sortBy.value === key) {
      sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    } else {
      sortBy.value = key;
      sortDir.value = "asc";
    }
  }

  function header(key: string, label: string) {
    return () =>
      h(UButton, {
        color: "neutral",
        variant: "ghost",
        label,
        icon:
          sortBy.value !== key
            ? "i-lucide-arrow-up-down"
            : sortDir.value === "asc"
              ? "i-lucide-arrow-up-narrow-wide"
              : "i-lucide-arrow-down-wide-narrow",
        class: "-mx-2.5",
        onClick: () => toggle(key),
      });
  }

  return { header };
}
