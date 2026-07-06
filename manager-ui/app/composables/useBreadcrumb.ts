import type { InjectionKey, Ref } from "vue";
import type { BreadcrumbItem } from "@nuxt/ui";

const BreadcrumbKey: InjectionKey<{
  items: Ref<BreadcrumbItem[]>;
  set: (v: BreadcrumbItem[]) => void;
}> = Symbol("breadcrumb");

export function provideBreadcrumb() {
  const { t } = useI18n();
  const items: Ref<BreadcrumbItem[]> = ref([]);
  provide(BreadcrumbKey, {
    items,
    set: (v) => {
      items.value = [{ label: t("nav.home"), icon: "i-lucide-house", to: "/" }, ...v];
    },
  });
  return items;
}

export function useBreadcrumb() {
  const ctx = inject(BreadcrumbKey);
  if (!ctx) throw new Error("useBreadcrumb called outside BreadcrumbProvider");
  return ctx;
}
