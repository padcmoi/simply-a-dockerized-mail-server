import { useWindowFocus as useVueWindowFocus } from "@vueuse/core";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";
import { useDomainStore } from "~/stores/domain";

export function useWindowFocus() {
  const auth = useAuthStore();
  const perms = usePermissionsStore();
  const domain = useDomainStore();
  const focused = useVueWindowFocus();

  async function checkCurrentRoute() {
    const route = useRoute();
    const meta = route.meta;
    const isRoot = auth.session?.isRoot ?? false;
    if (meta.rootOnly && !isRoot) {
      showError({ statusCode: 403 });
      return;
    }
    if (!isRoot) {
      for (const req of meta.requiredGlobal ?? []) {
        if (!perms.hasGlobal(req.resource, req.action)) {
          showError({ statusCode: 403 });
          return;
        }
      }
      if (domain.selected) {
        for (const req of meta.requiredDomain ?? []) {
          if (!perms.hasDomain(domain.selected.id, req.resource, req.action)) {
            showError({ statusCode: 403 });
            return;
          }
        }
      }
    }
  }

  watch(focused, (v) => console.info("useWindowFocus", v ? "focus" : "lost"));

  return { focused, checkCurrentRoute };
}
