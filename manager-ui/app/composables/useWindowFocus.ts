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

  async function onFocusGain() {
    console.info("[windowFocus] focus gained — verifying session");
    if (!auth.isAuthenticated) {
      console.info("[windowFocus] not authenticated, skipping");
      return;
    }
    const ok = await auth.refresh().catch(() => false);
    console.info("[windowFocus] auth.refresh() →", ok);
    if (!ok) {
      console.info("[windowFocus] token invalid → /login");
      await navigateTo("/login");
      return;
    }
    await Promise.all([auth.fetchProfile(), perms.fetch()]).catch(() => undefined);
    console.info("[windowFocus] profile + permissions refreshed");
    await checkCurrentRoute();
  }

  function onFocusLoss() {
    console.info("[windowFocus] focus lost");
  }

  watch(focused, (isFocused) => {
    if (isFocused) onFocusGain();
    else onFocusLoss();
  });

  return { focused, checkCurrentRoute };
}
