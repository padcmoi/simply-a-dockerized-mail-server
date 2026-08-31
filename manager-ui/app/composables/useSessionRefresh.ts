import { useDocumentVisibility } from "@vueuse/core";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";
import { useDataRefresh } from "~/composables/useDataRefresh";

export function useSessionRefresh() {
  const auth = useAuthStore();
  const perms = usePermissionsStore();
  const { focused, checkCurrentRoute } = useWindowFocus();
  const { bump } = useDataRefresh();
  const visibility = useDocumentVisibility();

  async function refresh() {
    if (!auth.isAuthenticated) return;
    const ok = await auth.refreshIfNeeded().catch(() => false);
    if (!ok) {
      await navigateTo("/login");
      return;
    }
    await Promise.all([auth.fetchProfile(), perms.fetch()]).catch(() => undefined);
    await checkCurrentRoute();
    bump();
  }

  watch(focused, (isFocused) => {
    if (isFocused) refresh();
  });

  watch(visibility, (state) => {
    if (state === "visible") refresh();
  });

  return { refresh };
}
