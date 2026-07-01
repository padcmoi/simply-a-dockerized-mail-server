import type { InjectionKey, Ref } from "vue";
import type { BreadcrumbItem } from "@nuxt/ui";

const BreadcrumbKey: InjectionKey<{
  items: Ref<BreadcrumbItem[]>;
  set: (v: BreadcrumbItem[]) => void;
}> = Symbol("breadcrumb");

export function provideBreadcrumb() {
  const items = ref<BreadcrumbItem[]>([]);
  provide(BreadcrumbKey, {
    items,
    set: (v) => {
      items.value = v;
    },
  });
  return items;
}

export function useBreadcrumb() {
  return inject(BreadcrumbKey)!;
}
