import type { InjectionKey, Ref } from "vue";
import type { BreadcrumbItem } from "@nuxt/ui";

const BreadcrumbKey: InjectionKey<{
  items: Ref<BreadcrumbItem[]>;
  set: (v: BreadcrumbItem[]) => void;
}> = Symbol("breadcrumb");

// Where a page says where it is. The trail is the only thing naming the page:
// the header bar draws it in place of a title, and the browser tab is built
// from it too, so a page declares its position once and both follow.
export function provideBreadcrumb() {
  const { t } = useI18n();
  const items: Ref<BreadcrumbItem[]> = ref([]);
  provide(BreadcrumbKey, {
    items,
    // The trail is words only, no icon on any crumb, and it starts where the
    // page's own section starts: no Home crumb ahead of it.
    set: (v) => {
      items.value = [...v];
    },
  });

  // "Simply Mail Server :: Configuration > Connexion externe". A page that has
  // set nothing yet leaves the app's name alone.
  useHead({
    title: computed(() => {
      const trail = items.value.map((i) => String(i.label ?? "")).filter(Boolean);
      return trail.length ? `${t("app.name")} :: ${trail.join(" > ")}` : t("app.name");
    }),
  });

  return items;
}

export function useBreadcrumb() {
  const ctx = inject(BreadcrumbKey);
  if (!ctx) throw new Error("useBreadcrumb called outside a layout that provides it");
  return ctx;
}

// Non-throwing variant for components that may legitimately render without a
// provider -- notably ErrorBreadcrumb, which error.vue mounts inside whatever
// layout the errored route used (the `auth` layout provides no breadcrumb).
// Returns null there instead of throwing and taking the error page down.
export function useBreadcrumbOptional() {
  return inject(BreadcrumbKey, null);
}
