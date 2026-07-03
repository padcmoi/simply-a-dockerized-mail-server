import { useDocumentVisibility } from "@vueuse/core";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

export function useSessionRefresh() {
  const auth = useAuthStore();
  const perms = usePermissionsStore();
  const { checkCurrentRoute } = useWindowFocus();

  async function refresh() {
    if (!auth.isAuthenticated) return;
    console.info("[sessionRefresh] calling auth.refresh()");
    const ok = await auth.refresh().catch(() => false);
    console.info("[sessionRefresh] auth.refresh() result:", ok);
    if (!ok) {
      console.info("[sessionRefresh] refresh failed → navigating to /login");
      await navigateTo("/login");
      return;
    }
    await Promise.all([auth.fetchProfile(), perms.fetch()]).catch(() => undefined);
    await checkCurrentRoute();
  }

  const visibility = useDocumentVisibility();
  console.info("[sessionRefresh] init, current visibility:", visibility.value);
  watch(visibility, (state) => {
    console.info("[sessionRefresh] visibilitychange →", state);
    if (state === "visible") refresh();
  });

  return { refresh };
}
